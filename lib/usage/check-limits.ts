import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

export type UsageEventType =
  | "crawl.started"
  | "assistant.message"
  | "keywords.generate"
  | "seo.analyze"
  | "content.plan"
  | "content.document"
  | "content.generated_page"
  | "report.generated";

const aiGenerationEvents: UsageEventType[] = [
  "keywords.generate",
  "seo.analyze",
  "content.plan",
  "content.document",
  "content.generated_page",
];

export class UsageLimitError extends Error {
  status = 429;

  constructor(message = "You have reached your plan limit for this month.") {
    super(message);
    this.name = "UsageLimitError";
  }
}

function startOfDayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfMonthIso() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function numberLimit(limits: Record<string, unknown>, key: string) {
  const value = limits[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getPlan(organizationId: string) {
  const supabase = createAdminClient();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("plan_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) throw organizationError;
  const planId = typeof organization?.plan_id === "string" ? organization.plan_id : "free";

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, name, limits")
    .eq("id", planId)
    .maybeSingle();

  if (planError) throw planError;

  return {
    id: plan?.id ?? "free",
    name: plan?.name ?? "Free",
    limits: (plan?.limits && typeof plan.limits === "object" ? plan.limits : {}) as Record<string, unknown>,
  };
}

async function countEvents(input: {
  organizationId: string;
  userId?: string | null;
  websiteId?: string | null;
  eventTypes: UsageEventType[];
  since: string;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .gte("created_at", input.since);

  if (input.eventTypes.length === 1) {
    query = query.eq("event_type", input.eventTypes[0]);
  } else {
    query = query.in("event_type", input.eventTypes);
  }

  if (input.userId) query = query.eq("user_id", input.userId);
  if (input.websiteId) query = query.eq("website_id", input.websiteId);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function checkUsageLimit(input: {
  organizationId: string;
  userId?: string | null;
  websiteId?: string | null;
  eventType: UsageEventType;
}) {
  const plan = await getPlan(input.organizationId);

  if (input.eventType === "crawl.started") {
    const period = plan.id === "starter" ? "month" : "day";
    const limitKey = period === "month" ? "crawl_per_website_per_month" : "crawl_per_website_per_day";
    const limit = numberLimit(plan.limits, limitKey);
    if (!limit || !input.websiteId) return { allowed: true, plan };

    const used = await countEvents({
      organizationId: input.organizationId,
      websiteId: input.websiteId,
      eventTypes: ["crawl.started"],
      since: period === "month" ? startOfMonthIso() : startOfDayIso(),
    });

    if (used >= limit) {
      throw new UsageLimitError(
        period === "month"
          ? "You have reached the crawl limit for this month."
          : "You have reached the crawl limit for today.",
      );
    }
    return { allowed: true, plan, used, limit };
  }

  if (input.eventType === "assistant.message") {
    const limit = numberLimit(plan.limits, "ai_messages_per_day");
    if (!limit) return { allowed: true, plan };

    const used = await countEvents({
      organizationId: input.organizationId,
      userId: input.userId,
      eventTypes: ["assistant.message"],
      since: startOfDayIso(),
    });

    if (used >= limit) {
      throw new UsageLimitError("You have reached the AI message limit for today.");
    }
    return { allowed: true, plan, used, limit };
  }

  if (aiGenerationEvents.includes(input.eventType)) {
    const limit = numberLimit(plan.limits, "ai_generations_per_month");
    if (!limit) return { allowed: true, plan };

    const used = await countEvents({
      organizationId: input.organizationId,
      eventTypes: aiGenerationEvents,
      since: startOfMonthIso(),
    });

    if (used >= limit) {
      throw new UsageLimitError("You have reached the AI generation limit for this month.");
    }
    return { allowed: true, plan, used, limit };
  }

  if (input.eventType === "report.generated") {
    const limit = numberLimit(plan.limits, "reports_per_month");
    if (!limit) return { allowed: true, plan };

    const used = await countEvents({
      organizationId: input.organizationId,
      eventTypes: ["report.generated"],
      since: startOfMonthIso(),
    });

    if (used >= limit) {
      throw new UsageLimitError("You have reached the PDF report limit for this month.");
    }
    return { allowed: true, plan, used, limit };
  }

  return { allowed: true, plan };
}

export async function recordUsageEvent(input: {
  organizationId: string;
  userId?: string | null;
  websiteId?: string | null;
  eventType: UsageEventType;
  metadata?: Record<string, unknown>;
  tokensUsed?: number;
  estimatedCost?: number;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("usage_events").insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    website_id: input.websiteId ?? null,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
    tokens_used: Math.max(0, Math.round(input.tokensUsed ?? 0)),
    estimated_cost: Math.max(0, input.estimatedCost ?? 0),
  });

  if (error) throw error;
}

export async function getUsageSummary(organizationId: string) {
  const supabase = createAdminClient();
  const monthStart = startOfMonthIso();
  const dayStart = startOfDayIso();

  const [
    crawls,
    aiMessages,
    aiGenerations,
    reports,
    cost,
  ] = await Promise.all([
    countEvents({ organizationId, eventTypes: ["crawl.started"], since: monthStart }),
    countEvents({ organizationId, eventTypes: ["assistant.message"], since: dayStart }),
    countEvents({ organizationId, eventTypes: aiGenerationEvents, since: monthStart }),
    countEvents({ organizationId, eventTypes: ["report.generated"], since: monthStart }),
    supabase
      .from("usage_events")
      .select("estimated_cost")
      .eq("organization_id", organizationId)
      .gte("created_at", monthStart),
  ]);

  if (cost.error) throw cost.error;

  return {
    crawlsThisMonth: crawls,
    aiMessagesToday: aiMessages,
    aiGenerationsThisMonth: aiGenerations,
    reportsThisMonth: reports,
    estimatedAiCostThisMonth: (cost.data ?? []).reduce(
      (total, row) => total + Number(row.estimated_cost ?? 0),
      0,
    ),
  };
}

export function getUsageLimitErrorResponse(error: unknown) {
  if (error instanceof UsageLimitError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
