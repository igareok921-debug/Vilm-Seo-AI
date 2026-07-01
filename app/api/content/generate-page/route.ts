import { NextResponse } from "next/server";
import { isOpenAiConfigured } from "@/lib/openai";
import { generateLandingPageWithAi } from "@/lib/openai/landing-page-agent";
import { websites as demoWebsites } from "@/lib/data";
import { createDemoGeneratedPage } from "@/lib/seo/generated-page-demo";
import { isDemoModeAllowed, isSupabaseAdminConfigured } from "@/lib/supabase";
import { mapGeneratedPageRow } from "@/lib/supabase/generated-pages";
import {
  assertNoDemoContentLeak,
  cleanupDemoContentForWebsite,
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
} from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";

export const maxDuration = 180;

interface GeneratePageBody {
  websiteId?: unknown;
  keyword?: unknown;
  suggestedTitle?: unknown;
  suggestedMetaDescription?: unknown;
  suggestedSlug?: unknown;
  contentType?: unknown;
  searchIntent?: unknown;
}

export async function POST(request: Request) {
  let body: GeneratePageBody;

  try {
    body = (await request.json()) as GeneratePageBody;
  } catch {
    return NextResponse.json(
      { error: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

  if (!websiteId || !keyword) {
    return NextResponse.json(
      { error: "websiteId and keyword are required." },
      { status: 422 },
    );
  }

  if (!isSupabaseAdminConfigured()) {
    if (!isDemoModeAllowed()) {
      return NextResponse.json(
        { error: "Secure server configuration is missing. The AI landing page cannot be generated." },
        { status: 503 },
      );
    }

    const demoWebsite = demoWebsites.find((website) => website.id === websiteId) ?? demoWebsites[0];

    return NextResponse.json(
      {
        source: "demo",
        warning: "Platform storage is not configured. The preview page was not saved.",
        data: {
          page: createDemoGeneratedPage(demoWebsite, keyword),
        },
      },
      { status: 200 },
    );
  }

  try {
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    const { supabase, website, organizationId, workspace } = access;
    await cleanupDemoContentForWebsite(access);

    if (!isOpenAiConfigured()) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured. The AI landing page cannot be generated." },
        { status: 503 },
      );
    }

    await checkUsageLimit({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "content.generated_page",
    });

    const result = await generateLandingPageWithAi(website, {
      keyword,
      suggestedTitle: typeof body.suggestedTitle === "string" ? body.suggestedTitle : undefined,
      suggestedMetaDescription:
        typeof body.suggestedMetaDescription === "string" ? body.suggestedMetaDescription : undefined,
      suggestedSlug: typeof body.suggestedSlug === "string" ? body.suggestedSlug : undefined,
      contentType: typeof body.contentType === "string" ? body.contentType : undefined,
      searchIntent: typeof body.searchIntent === "string" ? body.searchIntent : undefined,
    });
    assertNoDemoContentLeak(website, result.data);

    const { data: saved, error: saveError } = await supabase
      .from("generated_pages")
      .upsert(
        {
          organization_id: organizationId,
          website_id: website.id,
          keyword,
          title: result.data.title,
          meta_title: result.data.metaTitle,
          meta_description: result.data.metaDescription,
          slug: result.data.slug,
          content: result.data.content,
          faq_schema: result.data.faqSchema,
          status: "draft",
        },
        { onConflict: "website_id,slug" },
      )
      .select(
        "id, website_id, keyword, title, meta_title, meta_description, slug, content, faq_schema, status, created_at, updated_at",
      )
      .single();

    if (saveError) throw saveError;

    const { data: updatedKeyword } = await supabase
      .from("keyword_research")
      .update({ status: "drafted" })
      .eq("website_id", website.id)
      .eq("keyword", keyword)
      .select("id, website_id, keyword, search_intent, difficulty, priority, content_type, suggested_title, suggested_meta_description, suggested_slug, status, created_at")
      .maybeSingle();

    await supabase.from("activity_logs").insert({
      website_id: website.id,
      action: "ai.generated_page.completed",
      description: `AI landing page generated for keyword ${keyword}`,
      metadata: {
        generated_page_id: saved.id,
        model: result.model,
        tokens: result.totalTokens,
        estimated_cost_usd: result.estimatedCostUsd,
      },
    });

    await recordUsageEvent({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "content.generated_page",
      tokensUsed: result.totalTokens,
      estimatedCost: result.estimatedCostUsd,
      metadata: { model: result.model, page_id: saved.id, keyword },
    });

    return NextResponse.json({
      source: "supabase",
      data: {
        page: mapGeneratedPageRow(saved),
        keyword: updatedKeyword,
      },
      usage: {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        estimatedCostUsd: result.estimatedCostUsd,
      },
    });
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;
    const usageError = getUsageLimitErrorResponse(error);
    if (usageError) return usageError;

    console.error("[api/content/generate-page] Landing page generation failed:", error);

    return NextResponse.json(
      {
        error:
          "The landing page could not be generated. Check the AI and platform configuration.",
      },
      { status: 500 },
    );
  }
}
