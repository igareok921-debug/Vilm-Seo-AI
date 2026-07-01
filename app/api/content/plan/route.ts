import { NextResponse } from "next/server";
import { websites as demoWebsites } from "@/lib/data";
import { isOpenAiConfigured } from "@/lib/openai";
import { generateContentPlanWithAi } from "@/lib/openai/keyword-agent";
import { getDemoContentPlan } from "@/lib/seo/keyword-demo";
import { isDemoModeAllowed, isSupabaseAdminConfigured } from "@/lib/supabase";
import { mapContentPlanRow } from "@/lib/supabase/keyword-research";
import {
  assertNoDemoContentLeak,
  cleanupDemoContentForWebsite,
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
} from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";

export const maxDuration = 120;

interface PlanBody {
  websiteId?: unknown;
}

export async function POST(request: Request) {
  let body: PlanBody;

  try {
    body = (await request.json()) as PlanBody;
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
        { error: "Secure server configuration is missing. The editorial plan cannot be generated." },
        { status: 503 },
      );
    }

    const demoWebsite = demoWebsites.find((website) => website.id === websiteId) ?? demoWebsites[0];
    return NextResponse.json(
      {
        source: "demo",
        warning: "Platform storage is not configured. Preview data is being returned.",
        data: {
          plans: getDemoContentPlan(demoWebsite),
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
        { error: "OPENAI_API_KEY is not configured. The AI editorial plan cannot be generated." },
        { status: 503 },
      );
    }

    await checkUsageLimit({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "content.plan",
    });

    const result = await generateContentPlanWithAi(website);
    assertNoDemoContentLeak(website, result.data);
    const month = new Date().toISOString().slice(0, 7);

    const rows = result.data.plans.map((plan) => ({
      organization_id: organizationId,
      website_id: website.id,
      month,
      title: plan.title,
      content_type: plan.contentType,
      target_keyword: plan.targetKeyword,
      outline: [...plan.outline, `CTA: ${plan.recommendedCta}`],
      priority: plan.priority,
      status: "planned",
    }));

    const { data: savedPlans, error: planError } = await supabase
      .from("content_plans")
      .upsert(rows, { onConflict: "website_id,title" })
      .select("id, website_id, month, title, content_type, target_keyword, outline, priority, status, created_at");

    if (planError) throw planError;

    await supabase.from("activity_logs").insert({
      website_id: website.id,
      action: "ai.content_plan.completed",
      description: `Plan editorial AI generat pentru ${website.url}`,
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
      eventType: "content.plan",
      tokensUsed: result.totalTokens,
      estimatedCost: result.estimatedCostUsd,
      metadata: { model: result.model, plans: savedPlans.length },
    });

    return NextResponse.json({
      source: "supabase",
      data: {
        plans: savedPlans.map(mapContentPlanRow),
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

    console.error("[api/content/plan] Editorial plan generation failed:", error);

    return NextResponse.json(
      {
        error:
          "The AI editorial plan could not be generated. Check the AI and platform configuration.",
      },
      { status: 500 },
    );
  }
}
