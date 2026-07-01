import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/lib/openai";
import { analyzePageWithAi } from "@/lib/openai/seo-agent";
import { mapAiRecommendation } from "@/lib/supabase/ai-recommendations";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";

export const maxDuration = 120;

interface AnalyzeBody {
  pageId?: unknown;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured for server-side operations." },
      { status: 503 },
    );
  }

  if (!isOpenAiConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured in .env.local." },
      { status: 503 },
    );
  }

  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json(
      { error: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  if (!pageId) {
    return NextResponse.json({ error: "pageId is required." }, { status: 422 });
  }

  try {
    const userSupabase = await createClient();
    const { data: page, error: pageError } = await userSupabase
      .from("pages")
      .select(
        "id, website_id, url, title, meta_description, h1, h2, word_count, seo_score, language",
      )
      .eq("id", pageId)
      .maybeSingle();

    if (pageError) throw pageError;
    if (!page) {
      return NextResponse.json(
        { error: "The page does not exist. Run the crawler first." },
        { status: 404 },
      );
    }
    const { organizationId, workspace } = await getOwnedWebsiteForCurrentUser(page.website_id);
    const supabase = createAdminClient();

    await checkUsageLimit({
      organizationId,
      userId: workspace.user.id,
      websiteId: page.website_id,
      eventType: "seo.analyze",
    });

    const result = await analyzePageWithAi({
      url: page.url,
      title: page.title,
      metaDescription: page.meta_description,
      h1: page.h1,
      h2: page.h2 ?? [],
      wordCount: page.word_count,
      seoScore: page.seo_score,
      language: page.language,
    });

    const { analysis } = result;
    const { data: saved, error: saveError } = await supabase
      .from("ai_recommendations")
      .insert({
        organization_id: organizationId,
        website_id: page.website_id,
        page_id: page.id,
        model: result.model,
        seo_score_explanation: analysis.seoScoreExplanation,
        problems: analysis.problems,
        recommended_meta_title: analysis.recommendedMetaTitle,
        recommended_meta_description: analysis.recommendedMetaDescription,
        recommended_h1: analysis.recommendedH1,
        recommended_faq: analysis.recommendedFaq,
        internal_linking_suggestions: analysis.internalLinkingSuggestions,
        content_suggestions: analysis.contentSuggestions,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        total_tokens: result.totalTokens,
        estimated_cost_usd: result.estimatedCostUsd,
      })
      .select(
        "id, page_id, model, seo_score_explanation, problems, recommended_meta_title, recommended_meta_description, recommended_h1, recommended_faq, internal_linking_suggestions, content_suggestions, input_tokens, output_tokens, total_tokens, estimated_cost_usd, created_at",
      )
      .single();

    if (saveError) throw saveError;

    await supabase.from("activity_logs").insert({
      website_id: page.website_id,
      action: "ai.seo_analysis.completed",
      description: `AI analysis completed for ${page.url}`,
      metadata: {
        page_id: page.id,
        recommendation_id: saved.id,
        model: result.model,
        tokens: result.totalTokens,
        estimated_cost_usd: result.estimatedCostUsd,
      },
    });

    await recordUsageEvent({
      organizationId,
      userId: workspace.user.id,
      websiteId: page.website_id,
      eventType: "seo.analyze",
      metadata: {
        page_id: page.id,
        recommendation_id: saved.id,
        model: result.model,
      },
      tokensUsed: result.totalTokens,
      estimatedCost: result.estimatedCostUsd,
    });

    return NextResponse.json({
      data: mapAiRecommendation({
        ...saved,
        pages: { url: page.url },
      }),
    });
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;
    const usageErrorResponse = getUsageLimitErrorResponse(error);
    if (usageErrorResponse) return usageErrorResponse;

    console.error("[api/seo/analyze] AI analysis failed:", error);

    const message = error instanceof Error ? error.message : "";
    const status =
      message.includes("quota") || message.includes("billing")
        ? 402
        : message.includes("rate limit")
          ? 429
          : 500;

    return NextResponse.json(
      {
        error:
          status === 402
            ? "Contul OpenAI nu are credit disponibil."
            : status === 429
              ? "The OpenAI limit was reached. Try again in a few moments."
              : "AI analysis could not be generated. Check the OpenAI key and try again.",
      },
      { status },
    );
  }
}
