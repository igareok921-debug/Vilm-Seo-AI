import "server-only";

import { websites as demoWebsites } from "@/lib/data";
import { isDemoModeAllowed, isSupabaseAdminConfigured } from "@/lib/supabase";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Website, WebsiteStatus } from "@/types";

export interface WebsiteRow {
  id: string;
  organization_id?: string | null;
  owner_organization_id?: string | null;
  normalized_domain?: string | null;
  name: string;
  url: string;
  language: string;
  niche: string;
  seo_score: number;
  pages_count: number;
  keywords_count: number;
  status: string;
  last_audit_at: string | null;
  created_at: string;
}

export interface WebsitesResult {
  websites: Website[];
  source: "supabase" | "demo";
  error?: string;
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

function getSupabaseErrorParts(error: unknown): SupabaseLikeError {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
  };
}

function logSupabaseError(context: string, error: unknown) {
  const parts = getSupabaseErrorParts(error);
  console.error(context, {
    message: parts.message ?? "Supabase error without a message.",
    code: parts.code ?? null,
    details: parts.details ?? null,
    hint: parts.hint ?? null,
  });
}

function getUserFacingWebsiteError(error: unknown) {
  const { code, message, hint } = getSupabaseErrorParts(error);
  if (code?.startsWith("PGRST")) {
    return `PostgREST error while reading websites (${code}). ${message ?? ""} ${hint ?? ""}`.trim();
  }
  if (message?.toLowerCase().includes("row-level security") || code === "42501") {
    return "RLS blocks reading websites. Check policies for profiles, organizations, organization_members, and websites.";
  }
  if (code === "42703") {
    return "Platform storage is not up to date. Contact support.";
  }
  return "Websites could not be loaded.";
}

export function mapWebsiteRow(row: WebsiteRow): Website {
  const statusMap: Record<string, WebsiteStatus> = {
    Active: "Active",
    Activ: "Active",
    Attention: "Attention",
    "Atenție": "Attention",
    Analyzing: "Analyzing",
    "Se analizează": "Analyzing",
  };
  const status = statusMap[row.status] ?? "Analyzing";

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    language: row.language,
    niche: row.niche,
    score: row.seo_score,
    pages: row.pages_count,
    keywords: row.keywords_count,
    status,
    lastAudit: row.last_audit_at ?? row.created_at,
  };
}

async function resolveOrganizationId(organizationId?: string) {
  if (organizationId) return organizationId;
  const workspace = await getCurrentWorkspace();
  return workspace?.organization.id ?? null;
}

export async function getWebsites(organizationId?: string): Promise<WebsitesResult> {
  if (isDemoModeAllowed()) {
    return { websites: demoWebsites, source: "demo" };
  }

  try {
    const resolvedOrganizationId = await resolveOrganizationId(organizationId);
    if (!resolvedOrganizationId) {
      return { websites: [], source: "supabase" };
    }

    const supabase = isSupabaseAdminConfigured() ? createAdminClient() : await createClient();
    let query = supabase
      .from("websites")
      .select(
        "id, organization_id, owner_organization_id, normalized_domain, name, url, language, niche, seo_score, pages_count, keywords_count, status, last_audit_at, created_at",
      )
      .order("created_at", { ascending: true });

    query = query.or(`owner_organization_id.eq.${resolvedOrganizationId},and(owner_organization_id.is.null,organization_id.eq.${resolvedOrganizationId})`);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      websites: (data as WebsiteRow[]).map(mapWebsiteRow),
      source: "supabase",
    };
  } catch (error) {
    logSupabaseError("Websites could not be loaded from Supabase:", error);
    return {
      websites: [],
      source: "supabase",
      error: getUserFacingWebsiteError(error),
    };
  }
}

export async function getWebsiteById(id: string, organizationId?: string): Promise<Website | null> {
  const demoWebsite = demoWebsites.find((website) => website.id === id);

  if (isDemoModeAllowed()) {
    return demoWebsite ?? null;
  }

  try {
    const resolvedOrganizationId = await resolveOrganizationId(organizationId);
    if (!resolvedOrganizationId) return null;

    const supabase = isSupabaseAdminConfigured() ? createAdminClient() : await createClient();
    let query = supabase
      .from("websites")
      .select(
        "id, organization_id, owner_organization_id, normalized_domain, name, url, language, niche, seo_score, pages_count, keywords_count, status, last_audit_at, created_at",
      )
      .eq("id", id);

    query = query.or(`owner_organization_id.eq.${resolvedOrganizationId},and(owner_organization_id.is.null,organization_id.eq.${resolvedOrganizationId})`);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapWebsiteRow(data as WebsiteRow) : null;
  } catch (error) {
    logSupabaseError(`Website could not be loaded: ${id}:`, error);
    return null;
  }
}
