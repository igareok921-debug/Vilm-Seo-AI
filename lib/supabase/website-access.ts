import "server-only";

import { getCurrentWorkspace, type UserWorkspace } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mapWebsiteRow, type WebsiteRow } from "@/lib/supabase/websites";
import type { Website } from "@/types";

export interface OwnedWebsiteAccess {
  supabase: ReturnType<typeof createAdminClient>;
  workspace: UserWorkspace;
  organizationId: string;
  website: Website;
  websiteRow: WebsiteRow;
}

export class WebsiteAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WebsiteAccessError";
    this.status = status;
  }
}

export function logSupabaseError(context: string, error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    console.error(context, {
      message: typeof record.message === "string" ? record.message : "Supabase error without a message.",
      code: typeof record.code === "string" ? record.code : null,
      details: typeof record.details === "string" ? record.details : null,
      hint: typeof record.hint === "string" ? record.hint : null,
    });
    return;
  }

  console.error(context, {
    message: error instanceof Error ? error.message : String(error),
    code: null,
    details: null,
    hint: null,
  });
}

export async function getOwnedWebsiteForCurrentUser(websiteId: string): Promise<OwnedWebsiteAccess> {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    throw new WebsiteAccessError("You must be signed in for this action.", 401);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("websites")
    .select(
      "id, organization_id, owner_organization_id, normalized_domain, name, url, language, niche, seo_score, pages_count, keywords_count, status, last_audit_at, created_at",
    )
    .eq("id", websiteId)
    .or(`owner_organization_id.eq.${workspace.organization.id},and(owner_organization_id.is.null,organization_id.eq.${workspace.organization.id})`)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new WebsiteAccessError("You do not have access to this website.", 403);
  }

  return {
    supabase,
    workspace,
    organizationId: workspace.organization.id,
    website: mapWebsiteRow(data as WebsiteRow),
    websiteRow: data as WebsiteRow,
  };
}

export function getWebsiteAccessErrorResponse(error: unknown) {
  if (error instanceof WebsiteAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return null;
}

const forbiddenDemoTerms = [
  "caro cakes",
  "carocakes",
  "torturi",
  "cupcakes",
  "macarons",
  "candy bar",
];

export function isCaroCakesWebsite(website: Pick<Website, "name" | "url">) {
  const haystack = `${website.name} ${website.url}`.toLowerCase();
  return haystack.includes("caro") || haystack.includes("carocakes");
}

export function containsCaroCakesLeak(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const normalized = text.toLowerCase();
  return forbiddenDemoTerms.some((term) => normalized.includes(term));
}

export function assertNoDemoContentLeak(website: Pick<Website, "name" | "url">, content: unknown) {
  if (isCaroCakesWebsite(website) || !containsCaroCakesLeak(content)) return;

  const message =
    `Generated content appears contaminated with CaroCakes examples for website ${website.url}.`;

  if (process.env.NODE_ENV === "development") {
    console.warn(`[ai-content-guard] ${message}`);
  }

  throw new WebsiteAccessError(
    "Generated content does not match the selected website. Try generating it again.",
    422,
  );
}

export async function cleanupDemoContentForWebsite(access: OwnedWebsiteAccess) {
  if (isCaroCakesWebsite(access.website)) return;

  const { supabase, website } = access;

  const [plans, keywords, pages, documents] = await Promise.all([
    supabase
      .from("content_plans")
      .select("id, title, target_keyword, outline")
      .eq("website_id", website.id),
    supabase
      .from("keyword_research")
      .select("id, keyword, suggested_title, suggested_meta_description")
      .eq("website_id", website.id),
    supabase
      .from("generated_pages")
      .select("id, keyword, title, meta_title, meta_description, content")
      .eq("website_id", website.id),
    supabase
      .from("ai_documents")
      .select("id, keyword, title, content")
      .eq("website_id", website.id),
  ]);

  const planIds = (plans.data ?? [])
    .filter((row) => containsCaroCakesLeak(row))
    .map((row) => row.id);
  const keywordIds = (keywords.data ?? [])
    .filter((row) => containsCaroCakesLeak(row))
    .map((row) => row.id);
  const pageIds = (pages.data ?? [])
    .filter((row) => containsCaroCakesLeak(row))
    .map((row) => row.id);
  const documentIds = (documents.data ?? [])
    .filter((row) => containsCaroCakesLeak(row))
    .map((row) => row.id);

  await Promise.all([
    planIds.length
      ? supabase.from("content_plans").delete().eq("website_id", website.id).in("id", planIds)
      : Promise.resolve(),
    keywordIds.length
      ? supabase.from("keyword_research").delete().eq("website_id", website.id).in("id", keywordIds)
      : Promise.resolve(),
    pageIds.length
      ? supabase.from("generated_pages").delete().eq("website_id", website.id).in("id", pageIds)
      : Promise.resolve(),
    documentIds.length
      ? supabase.from("ai_documents").delete().eq("website_id", website.id).in("id", documentIds)
      : Promise.resolve(),
  ]);
}
