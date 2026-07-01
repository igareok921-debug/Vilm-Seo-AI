import { NextResponse } from "next/server";
import { websites as demoWebsites } from "@/lib/data";
import { isOpenAiConfigured } from "@/lib/openai";
import { generateKeywordResearchWithAi } from "@/lib/openai/keyword-agent";
import { getDemoKeywordClusters, getDemoKeywordResearch } from "@/lib/seo/keyword-demo";
import { isDemoModeAllowed, isSupabaseAdminConfigured } from "@/lib/supabase";
import { mapKeywordClusterRow, mapKeywordResearchRow } from "@/lib/supabase/keyword-research";
import {
  assertNoDemoContentLeak,
  cleanupDemoContentForWebsite,
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
} from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";

export const maxDuration = 120;

interface GenerateBody {
  websiteId?: unknown;
}

export async function POST(request: Request) {
  let body: GenerateBody;

  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 422 });
  }

  if (!isSupabaseAdminConfigured()) {
    if (!isDemoModeAllowed()) {
      return NextResponse.json(
        { error: "Secure server configuration is missing. Keyword research cannot be generated." },
        { status: 503 },
      );
    }

    const demoWebsite = demoWebsites.find((website) => website.id === websiteId) ?? demoWebsites[0];
    return NextResponse.json(
      {
        source: "demo",
        warning: "Platform storage is not configured. Preview data is being returned.",
        data: {
          keywords: getDemoKeywordResearch(demoWebsite),
          clusters: getDemoKeywordClusters(demoWebsite),
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
        { error: "OPENAI_API_KEY is not configured. AI keyword research cannot be generated." },
        { status: 503 },
      );
    }

    await checkUsageLimit({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "keywords.generate",
    });

    const result = await generateKeywordResearchWithAi(website);
    assertNoDemoContentLeak(website, result.data);

    const keywordRows = result.data.keywords.map((item) => ({
      organization_id: organizationId,
      website_id: website.id,
      keyword: item.keyword,
      search_intent: item.searchIntent,
      difficulty: item.difficulty,
      priority: item.priority,
      content_type: item.contentType,
      suggested_title: item.suggestedTitle,
      suggested_meta_description: item.suggestedMetaDescription,
      suggested_slug: item.suggestedSlug,
      status: "planned",
    }));

    const clusterRows = result.data.clusters.map((cluster) => ({
      organization_id: organizationId,
      website_id: website.id,
      cluster_name: cluster.clusterName,
      main_keyword: cluster.mainKeyword,
      related_keywords: cluster.relatedKeywords,
      priority: cluster.priority,
    }));

    const { data: savedKeywords, error: keywordError } = await supabase
      .from("keyword_research")
      .upsert(keywordRows, { onConflict: "website_id,keyword" })
      .select(
        "id, website_id, keyword, search_intent, difficulty, priority, content_type, suggested_title, suggested_meta_description, suggested_slug, status, created_at",
      );

    if (keywordError) throw keywordError;

    const { data: savedClusters, error: clusterError } = await supabase
      .from("keyword_clusters")
      .upsert(clusterRows, { onConflict: "website_id,cluster_name" })
      .select("id, website_id, cluster_name, main_keyword, related_keywords, priority, created_at");

    if (clusterError) throw clusterError;

    await supabase.from("activity_logs").insert({
      website_id: website.id,
      action: "ai.keyword_research.completed",
      description: `Keyword research AI generat pentru ${website.url}`,
      metadata: {
        model: result.model,
        tokens: result.totalTokens,
        estimated_cost_usd: result.estimatedCostUsd,
      },
    });

    await recordUsageEvent({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "keywords.generate",
      tokensUsed: result.totalTokens,
      estimatedCost: result.estimatedCostUsd,
      metadata: { model: result.model, keywords: savedKeywords.length, clusters: savedClusters.length },
    });

    return NextResponse.json({
      source: "supabase",
      data: {
        keywords: savedKeywords.map(mapKeywordResearchRow),
        clusters: savedClusters.map(mapKeywordClusterRow),
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

    console.error("[api/keywords/generate] Keyword research generation failed:", error);

    return NextResponse.json(
      {
        error:
          "AI keyword research could not be generated. Check the AI and platform configuration.",
      },
      { status: 500 },
    );
  }
}
