import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSearchConsoleDashboard } from "@/lib/google/search-console";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { SeoReport, Website } from "@/types";

export interface ReportsDataset {
  source: "supabase" | "empty";
  reports: SeoReport[];
  error?: string;
}

export interface ReportSnapshot {
  website: Website;
  period: { start: string; end: string };
  generatedAt: string;
  includes: Record<string, boolean>;
  crawl: {
    latest: Record<string, unknown> | null;
    pages: Record<string, unknown>[];
  };
  audit: {
    latest: Record<string, unknown> | null;
    issues: Record<string, unknown>[];
  };
  keywords: {
    research: Record<string, unknown>[];
    clusters: Record<string, unknown>[];
  };
  content: {
    plans: Record<string, unknown>[];
    generatedPages: Record<string, unknown>[];
  };
  recommendations: Record<string, unknown>[];
  assistantReports: Record<string, unknown>[];
  searchConsole: Record<string, unknown> | null;
  activityLogs: Record<string, unknown>[];
  metrics: {
    seoScore: number | null;
    pagesAnalyzed: number;
    issuesDetected: number;
    criticalIssues: number;
    mediumIssues: number;
    lowIssues: number;
    pagesIndexed: number | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    averagePosition: number | null;
  };
  actionPlan: string[];
}

interface ReportRow {
  id: string;
  website_id: string;
  title: string;
  type: string;
  status: SeoReport["status"];
  period_start: string;
  period_end: string;
  summary: string | null;
  data: Record<string, unknown>;
  pdf_url: string | null;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}

function mapReport(row: ReportRow): SeoReport {
  return {
    id: row.id,
    websiteId: row.website_id,
    title: row.title,
    type: row.type,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summary: row.summary,
    data: row.data ?? {},
    pdfUrl: row.pdf_url,
    downloadsCount: row.downloads_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export async function getReportsDataset(websiteId: string): Promise<ReportsDataset> {
  if (!websiteId || !isSupabaseAdminConfigured()) {
    return { source: "empty", reports: [] };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reports")
      .select("id, website_id, title, type, status, period_start, period_end, summary, data, pdf_url, downloads_count, created_at, updated_at")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return { source: "supabase", reports: (data ?? []).map((row) => mapReport(row as ReportRow)) };
  } catch (error) {
    console.error("[reports] Reports could not be loaded:", error);
    return {
      source: "supabase",
      reports: [],
      error: "Reports could not be loaded.",
    };
  }
}

export async function getReportById(id: string): Promise<SeoReport | null> {
  if (!id || !isSupabaseAdminConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reports")
      .select("id, website_id, title, type, status, period_start, period_end, summary, data, pdf_url, downloads_count, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapReport(data as ReportRow) : null;
  } catch (error) {
    console.error("[reports] Report could not be loaded:", error);
    return null;
  }
}

export async function incrementReportDownload(id: string, websiteId: string) {
  if (!id || !websiteId || !isSupabaseAdminConfigured()) return;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("reports")
    .select("downloads_count")
    .eq("id", id)
    .eq("website_id", websiteId)
    .maybeSingle();

  await supabase
    .from("reports")
    .update({ downloads_count: Number(data?.downloads_count ?? 0) + 1 })
    .eq("id", id)
    .eq("website_id", websiteId);
}

export async function collectReportSnapshot(input: {
  website: Website;
  periodStart: string;
  periodEnd: string;
  includes: Record<string, boolean>;
}): Promise<ReportSnapshot> {
  const supabase = createAdminClient();
  const websiteId = input.website.id;

  const [crawlsHistoryResult, latestCompletedCrawlResult] = await Promise.all([
    supabase
      .from("crawls")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("crawls")
      .select("*")
      .eq("website_id", websiteId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (crawlsHistoryResult.error) throw crawlsHistoryResult.error;
  if (latestCompletedCrawlResult.error) throw latestCompletedCrawlResult.error;

  const crawlsData = crawlsHistoryResult.data;
  const crawls = isObjectArray(crawlsData);
  const latestCompletedCrawl = latestCompletedCrawlResult.data as Record<string, unknown> | null;

  const pagesQuery = latestCompletedCrawl?.id
    ? supabase
        .from("pages")
        .select("*")
        .eq("website_id", websiteId)
        .eq("crawl_id", String(latestCompletedCrawl.id))
        .order("crawled_at", { ascending: false })
        .limit(50)
    : null;
  const auditsQuery = supabase
    .from("seo_audits")
    .select("*")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(5);

  const [
    pagesResult,
    auditsResult,
    keywordsResult,
    clustersResult,
    plansResult,
    generatedPagesResult,
    recommendationsResult,
    assistantReportsResult,
    logsResult,
  ] = await Promise.all([
    pagesQuery ?? Promise.resolve({ data: [] }),
    latestCompletedCrawl?.id ? auditsQuery.eq("crawl_id", String(latestCompletedCrawl.id)) : auditsQuery,
    supabase.from("keyword_research").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(50),
    supabase.from("keyword_clusters").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(20),
    supabase.from("content_plans").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(30),
    supabase.from("generated_pages").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_recommendations").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(20),
    supabase.from("assistant_reports").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(10),
    supabase.from("activity_logs").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }).limit(20),
  ]);

  const pages = isObjectArray(pagesResult.data);
  const audits = isObjectArray(auditsResult.data);
  const latestAudit = audits[0] ?? null;

  let auditIssues: Record<string, unknown>[] = [];
  if (latestAudit?.id) {
    const { data } = await supabase
      .from("audit_issues")
      .select("*")
      .eq("audit_id", String(latestAudit.id))
      .order("created_at", { ascending: false })
      .limit(100);
    auditIssues = isObjectArray(data);
  }

  let searchConsole: Record<string, unknown> | null = null;
  try {
    const dashboard = await getSearchConsoleDashboard(websiteId);
    searchConsole = dashboard.source === "google" && dashboard.connected ? (dashboard as unknown as Record<string, unknown>) : null;
  } catch {
    searchConsole = null;
  }

  const scMetrics = searchConsole?.metrics as
    | { clicks?: number; impressions?: number; ctr?: number; position?: number }
    | undefined;
  const criticalIssues = auditIssues.filter((issue) => issue.severity === "critical").length;
  const mediumIssues = auditIssues.filter((issue) => issue.severity === "warning" || issue.severity === "medium").length;
  const lowIssues = auditIssues.filter((issue) => issue.severity === "notice" || issue.severity === "low").length;

  const snapshot: ReportSnapshot = {
    website: input.website,
    period: { start: input.periodStart, end: input.periodEnd },
    generatedAt: new Date().toISOString(),
    includes: input.includes,
    crawl: {
      latest: crawls[0] ?? null,
      pages: pages.slice(0, 30),
    },
    audit: {
      latest: latestAudit,
      issues: auditIssues.slice(0, 50),
    },
    keywords: {
      research: isObjectArray(keywordsResult.data),
      clusters: isObjectArray(clustersResult.data),
    },
    content: {
      plans: isObjectArray(plansResult.data),
      generatedPages: isObjectArray(generatedPagesResult.data),
    },
    recommendations: isObjectArray(recommendationsResult.data),
    assistantReports: isObjectArray(assistantReportsResult.data),
    searchConsole,
    activityLogs: isObjectArray(logsResult.data),
    metrics: {
      seoScore: latestAudit?.score ? Number(latestAudit.score) : input.website.score,
      pagesAnalyzed: Number(crawls[0]?.pages_crawled ?? pages.length ?? 0),
      issuesDetected: Number(crawls[0]?.issues_found ?? auditIssues.length ?? 0),
      criticalIssues,
      mediumIssues,
      lowIssues,
      pagesIndexed: searchConsole ? pages.filter((page) => Number(page.status_code ?? 0) < 400).length : null,
      clicks: typeof scMetrics?.clicks === "number" ? scMetrics.clicks : null,
      impressions: typeof scMetrics?.impressions === "number" ? scMetrics.impressions : null,
      ctr: typeof scMetrics?.ctr === "number" ? scMetrics.ctr : null,
      averagePosition: typeof scMetrics?.position === "number" ? scMetrics.position : null,
    },
    actionPlan: [
      "Prioritize critical audit issues.",
      "Finalize generated pages for high-priority keywords.",
      "Run a crawl after each major set of fixes.",
      "Connect or verify Search Console for real performance data.",
    ],
  };

  return snapshot;
}

export async function saveReportPdf(input: {
  reportId: string;
  websiteId: string;
  pdfBuffer: Buffer;
}) {
  const fileName = `reports/${input.websiteId}/${input.reportId}.pdf`;
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.storage
      .from("reports")
      .upload(fileName, input.pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!error) {
      const { data } = supabase.storage.from("reports").getPublicUrl(fileName);
      return data.publicUrl;
    }

    if (process.env.VERCEL) {
      throw new Error(`Report PDF upload failed: ${error.message}`);
    }
  } catch (error) {
    if (process.env.VERCEL) {
      throw error;
    }

    console.warn("[reports] Report storage unavailable, using local fallback:", error);
  }

  const publicDir = path.join(process.cwd(), "public", "reports", input.websiteId);
  await mkdir(publicDir, { recursive: true });
  const filePath = path.join(publicDir, `${input.reportId}.pdf`);
  await writeFile(filePath, input.pdfBuffer);
  return `/reports/${input.websiteId}/${input.reportId}.pdf`;
}
