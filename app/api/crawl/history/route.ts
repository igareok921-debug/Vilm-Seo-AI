import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
} from "@/lib/supabase/website-access";

type CleanupMode = "keep_latest" | "older_than_7_days" | "delete_all" | "delete_single";

interface CleanupRequest {
  websiteId?: unknown;
  crawlId?: unknown;
  mode?: unknown;
}

function isCleanupMode(value: unknown): value is CleanupMode {
  return (
    value === "keep_latest" ||
    value === "older_than_7_days" ||
    value === "delete_all" ||
    value === "delete_single"
  );
}

async function getCrawlIdsToDelete(websiteId: string, mode: CleanupMode, crawlId?: string) {
  const supabase = createAdminClient();

  if (mode === "delete_single") {
    if (!crawlId) {
      throw new Error("crawlId is required for delete_single.");
    }

    const { data, error } = await supabase
      .from("crawls")
      .select("id")
      .eq("website_id", websiteId)
      .eq("id", crawlId)
      .maybeSingle();

    if (error) throw error;
    return data ? [data.id as string] : [];
  }

  if (mode === "delete_all") {
    const { data, error } = await supabase
      .from("crawls")
      .select("id")
      .eq("website_id", websiteId);
    if (error) throw error;
    return (data ?? []).map((crawl) => crawl.id as string);
  }

  if (mode === "older_than_7_days") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const { data, error } = await supabase
      .from("crawls")
      .select("id")
      .eq("website_id", websiteId)
      .lt("created_at", cutoff.toISOString());
    if (error) throw error;
    return (data ?? []).map((crawl) => crawl.id as string);
  }

  const { data: latest, error: latestError } = await supabase
    .from("crawls")
    .select("id, created_at")
    .eq("website_id", websiteId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  if (!latest) return [];

  const { data, error } = await supabase
    .from("crawls")
    .select("id")
    .eq("website_id", websiteId)
    .neq("id", latest.id)
    .lt("created_at", latest.created_at);

  if (error) throw error;
  return (data ?? []).map((crawl) => crawl.id as string);
}

export async function DELETE(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured for history cleanup." },
      { status: 503 },
    );
  }

  let body: CleanupRequest;
  try {
    body = (await request.json()) as CleanupRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const crawlId = typeof body.crawlId === "string" ? body.crawlId.trim() : "";
  const mode = isCleanupMode(body.mode) ? body.mode : null;

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  if (!mode) {
    return NextResponse.json(
      { error: "mode must be keep_latest, older_than_7_days, delete_all, or delete_single." },
      { status: 400 },
    );
  }

  if (mode === "delete_single" && !crawlId) {
    return NextResponse.json({ error: "crawlId is required to delete a single crawl." }, { status: 400 });
  }

  try {
    const { supabase } = await getOwnedWebsiteForCurrentUser(websiteId);

    const crawlIds = await getCrawlIdsToDelete(websiteId, mode, crawlId);
    if (crawlIds.length === 0) {
      return NextResponse.json({ data: { deletedCrawls: 0 } });
    }

    const { error: crawlRowsError } = await supabase
      .from("crawls")
      .select("id")
      .eq("website_id", websiteId)
      .in("id", crawlIds);

    if (crawlRowsError) throw crawlRowsError;

    const { data: audits, error: auditsError } = await supabase
      .from("seo_audits")
      .select("id")
      .eq("website_id", websiteId)
      .in("crawl_id", crawlIds);

    if (auditsError) throw auditsError;
    const auditIds = (audits ?? []).map((audit) => audit.id as string);

    if (auditIds.length) {
      const { error: issuesError } = await supabase
        .from("audit_issues")
        .delete()
        .in("audit_id", auditIds);
      if (issuesError) throw issuesError;

      const { error: auditDeleteError } = await supabase
        .from("seo_audits")
        .delete()
        .eq("website_id", websiteId)
        .in("id", auditIds);
      if (auditDeleteError) throw auditDeleteError;
    }

    for (const crawlId of crawlIds) {
      await supabase
        .from("activity_logs")
        .delete()
        .eq("website_id", websiteId)
        .filter("metadata->>crawl_id", "eq", crawlId);
    }

    const { error: pagesError } = await supabase
      .from("pages")
      .delete()
      .eq("website_id", websiteId)
      .in("crawl_id", crawlIds);
    if (pagesError) throw pagesError;

    const { error: crawlsError } = await supabase
      .from("crawls")
      .delete()
      .eq("website_id", websiteId)
      .in("id", crawlIds);
    if (crawlsError) throw crawlsError;

    await supabase.from("activity_logs").insert({
      website_id: websiteId,
      action: mode === "delete_single" ? "crawl.deleted" : "crawl.history.cleaned",
      description:
        mode === "delete_single"
          ? "Crawl deleted from history."
          : `Crawl history cleaned: ${crawlIds.length} crawls deleted.`,
      metadata: {
        mode,
        deleted_crawl_ids: crawlIds,
      },
    });

    return NextResponse.json({
      data: {
        deletedCrawls: crawlIds.length,
      },
    });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[crawl-history] History cleanup failed:", error);
    return NextResponse.json(
      { error: "Crawl history could not be cleaned." },
      { status: 500 },
    );
  }
}
