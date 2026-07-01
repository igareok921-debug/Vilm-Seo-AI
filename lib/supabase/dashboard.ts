import "server-only";

import { getSearchConsoleDashboard } from "@/lib/google/search-console";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import type { SearchConsoleDashboardData } from "@/types";

export interface DashboardActivity {
  id: string;
  action: string;
  description: string | null;
  createdAt: string;
  tone: "success" | "warning" | "primary" | "muted";
}

export interface DashboardData {
  source: "supabase" | "empty";
  activities: DashboardActivity[];
  seoScores: number[];
  analyzedPages: number;
  detectedIssues: number;
  latestSeoScore: number | null;
  latestAuditStatus: string | null;
  searchConsole: SearchConsoleDashboardData | null;
  searchConsoleUnavailableReason: "not_connected" | "no_data" | "error" | null;
}

function toneForAction(action: string): DashboardActivity["tone"] {
  if (action.includes("failed") || action.includes("error")) return "warning";
  if (action.includes("completed") || action.includes("applied")) return "success";
  if (action.includes("ai") || action.includes("generated")) return "primary";
  return "muted";
}

export async function getDashboardData(websiteId: string): Promise<DashboardData> {
  if (!isSupabaseAdminConfigured()) {
    return {
      source: "empty",
      activities: [],
      seoScores: [],
      analyzedPages: 0,
      detectedIssues: 0,
      latestSeoScore: null,
      latestAuditStatus: null,
      searchConsole: null,
      searchConsoleUnavailableReason: "not_connected",
    };
  }

  try {
    const supabase = createAdminClient();
    const [activityResult, auditResult, crawlResult] = await Promise.all([
      supabase
        .from("activity_logs")
        .select("id, action, description, created_at")
        .eq("website_id", websiteId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("seo_audits")
        .select("id, score, status, created_at")
        .eq("website_id", websiteId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("crawls")
        .select("id, pages_crawled, issues_found, created_at")
        .eq("website_id", websiteId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (activityResult.error) throw activityResult.error;
    if (auditResult.error) throw auditResult.error;
    if (crawlResult.error) throw crawlResult.error;

    const audits = auditResult.data ?? [];
    const crawls = crawlResult.data ?? [];
    const latestAudit = audits[0] ?? null;
    const latestCrawl = crawls[0] ?? null;

    let detectedIssues = Number(latestCrawl?.issues_found ?? 0);
    if (latestAudit?.id) {
      const { count, error } = await supabase
        .from("audit_issues")
        .select("id", { count: "exact", head: true })
        .eq("audit_id", latestAudit.id)
        .eq("is_resolved", false);

      if (!error && typeof count === "number") {
        detectedIssues = count;
      }
    }

    let searchConsole: SearchConsoleDashboardData | null = null;
    let searchConsoleUnavailableReason: DashboardData["searchConsoleUnavailableReason"] =
      "not_connected";

    try {
      const dashboard = await getSearchConsoleDashboard(websiteId);
      if (dashboard.source === "google" && dashboard.connected) {
        searchConsole = dashboard;
        searchConsoleUnavailableReason =
          dashboard.metrics.clicks > 0 ||
          dashboard.metrics.impressions > 0 ||
          dashboard.topPages.length > 0
            ? null
            : "no_data";
      } else {
        searchConsoleUnavailableReason = dashboard.connected ? "no_data" : "not_connected";
      }
    } catch {
      searchConsoleUnavailableReason = "error";
    }

    return {
      source: "supabase",
      activities: (activityResult.data ?? []).map((activity) => ({
        id: activity.id,
        action: activity.action,
        description: activity.description,
        createdAt: activity.created_at,
        tone: toneForAction(activity.action),
      })),
      seoScores: audits
        .slice()
        .reverse()
        .map((audit) => Number(audit.score ?? 0)),
      analyzedPages: Number(latestCrawl?.pages_crawled ?? 0),
      detectedIssues,
      latestSeoScore: latestAudit ? Number(latestAudit.score ?? 0) : null,
      latestAuditStatus: latestAudit?.status ?? null,
      searchConsole,
      searchConsoleUnavailableReason,
    };
  } catch (error) {
    console.error("[dashboard] Dashboard data could not be loaded:", error);
    return {
      source: "empty",
      activities: [],
      seoScores: [],
      analyzedPages: 0,
      detectedIssues: 0,
      latestSeoScore: null,
      latestAuditStatus: null,
      searchConsole: null,
      searchConsoleUnavailableReason: "error",
    };
  }
}
