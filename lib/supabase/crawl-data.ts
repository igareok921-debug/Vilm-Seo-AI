import "server-only";

import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import type { CrawledPage } from "@/types";

export interface AuditSummary {
  id: string;
  score: number;
  status: string;
  summary: { pages?: number; issues?: number };
  completedAt: string | null;
}

export interface AuditIssueItem {
  id: string;
  title: string;
  description: string | null;
  severity: "critical" | "warning" | "notice";
  recommendation: string | null;
  pageUrl: string | null;
}

export interface WebsiteCrawlData {
  pages: CrawledPage[];
  audit: AuditSummary | null;
  issues: AuditIssueItem[];
}

export interface RecentCrawl {
  id: string;
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  startUrl: string | null;
  status: "pending" | "running" | "completed" | "failed";
  pagesDiscovered: number;
  pagesCrawled: number;
  issuesFound: number;
  progress: number;
  createdAt: string;
  hasPrevious: boolean;
}

export interface CrawlOverview {
  latestCompleted: RecentCrawl | null;
  completedCount: number;
}

function mapRecentCrawl(crawl: {
  id: string;
  website_id: string;
  status: "pending" | "running" | "completed" | "failed";
  pages_discovered: number;
  pages_crawled: number;
  issues_found: number;
  progress: number;
  start_url?: string | null;
  created_at: string;
  websites?: unknown;
}, hasPrevious = false): RecentCrawl {
  const website = crawl.websites as { name?: string; url?: string } | null;
  return {
    id: crawl.id,
    websiteId: crawl.website_id,
    websiteName: website?.name ?? "Website",
    websiteUrl: website?.url ?? "",
    startUrl: crawl.start_url ?? website?.url ?? "",
    status: crawl.status,
    pagesDiscovered: crawl.pages_discovered,
    pagesCrawled: crawl.pages_crawled,
    issuesFound: crawl.issues_found,
    progress: crawl.progress,
    createdAt: crawl.created_at,
    hasPrevious,
  };
}

export async function getRecentCrawls(websiteId?: string): Promise<RecentCrawl[]> {
  if (!isSupabaseAdminConfigured()) {
    return [];
  }

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("crawls")
      .select(
        "id, website_id, status, start_url, pages_discovered, pages_crawled, issues_found, progress, created_at, websites(name, url)",
      )
      .order("created_at", { ascending: false })
      .limit(11);

    if (websiteId) {
      query = query.eq("website_id", websiteId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = data ?? [];
    return rows.slice(0, 10).map((crawl, index) => mapRecentCrawl(crawl, index < rows.length - 1));
  } catch (error) {
    console.error("[crawl-data] Crawl history could not be loaded:", error);
    return [];
  }
}

export async function getCrawlOverview(websiteId?: string): Promise<CrawlOverview> {
  if (!websiteId || !isSupabaseAdminConfigured()) {
    return { latestCompleted: null, completedCount: 0 };
  }

  try {
    const supabase = createAdminClient();
    const [latestResult, countResult] = await Promise.all([
      supabase
        .from("crawls")
        .select(
          "id, website_id, status, start_url, pages_discovered, pages_crawled, issues_found, progress, created_at, websites(name, url)",
        )
        .eq("website_id", websiteId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("crawls")
        .select("id", { count: "exact", head: true })
        .eq("website_id", websiteId)
        .eq("status", "completed"),
    ]);

    if (latestResult.error) throw latestResult.error;
    if (countResult.error) throw countResult.error;

    return {
      latestCompleted: latestResult.data ? mapRecentCrawl(latestResult.data) : null,
      completedCount: countResult.count ?? 0,
    };
  } catch (error) {
    console.error("[crawl-data] Crawl overview could not be loaded:", error);
    return { latestCompleted: null, completedCount: 0 };
  }
}

export type CrawlIssueSeverity = "critical" | "high" | "medium" | "low";
export type CrawlIssueStatus = "open" | "resolved" | "ignored";

export interface CrawlIssueCenterItem {
  id: string;
  websiteId: string;
  issueType: string;
  category: string;
  title: string;
  pageUrl: string | null;
  pageTitle: string | null;
  impact: string;
  severity: CrawlIssueSeverity;
  description: string | null;
  recommendation: string | null;
  detectedAt: string;
  status: CrawlIssueStatus;
}

export interface CrawlIssuesStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}

export interface CrawlIssuesComparison {
  previousCrawlId: string | null;
  resolvedIssues: number;
  newIssues: number;
  remainingIssues: number;
  seoScoreDiff: number | null;
}

export interface CrawlIssuesCenterData {
  configured: boolean;
  website: {
    id: string;
    name: string;
    url: string;
  } | null;
  crawl: {
    id: string;
    startedAt: string | null;
    completedAt: string | null;
    pagesCrawled: number;
    issuesFound: number;
    durationSeconds: number | null;
  } | null;
  audit: {
    id: string;
    score: number;
  } | null;
  issues: CrawlIssueCenterItem[];
  stats: CrawlIssuesStats;
  comparison: CrawlIssuesComparison;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function normalizeIssueSeverity(severity: string | null | undefined): CrawlIssueSeverity {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "medium";
  if (severity === "notice") return "low";
  if (severity === "high" || severity === "medium" || severity === "low") return severity;
  return "low";
}

function inferIssueCategory(code: string, title: string) {
  const value = `${code} ${title}`.toLowerCase();
  if (value.includes("meta")) return "Meta Description";
  if (value.includes("title")) return "Title";
  if (value.includes("h1")) return "H1";
  if (value.includes("image")) return "Images";
  if (value.includes("alt")) return "ALT";
  if (value.includes("internal")) return "Internal Links";
  if (value.includes("external")) return "External Links";
  if (value.includes("schema")) return "Schema";
  if (value.includes("load") || value.includes("speed") || value.includes("performance")) return "Performance";
  if (value.includes("canonical")) return "Canonical";
  if (value.includes("robots")) return "Robots";
  if (value.includes("open_graph") || value.includes("opengraph")) return "OpenGraph";
  if (value.includes("twitter")) return "Twitter Cards";
  if (value.includes("eeat")) return "EEAT";
  return "Content";
}

function impactFromSeverity(severity: CrawlIssueSeverity) {
  if (severity === "critical") return "Major impact on indexing or relevance.";
  if (severity === "high") return "High impact on organic visibility.";
  if (severity === "medium") return "Medium impact on CTR or relevance.";
  return "Low impact, but worth monitoring.";
}

function emptyStats(): CrawlIssuesStats {
  return { total: 0, critical: 0, high: 0, medium: 0, low: 0, resolved: 0 };
}

function getDurationSeconds(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return null;
  const seconds = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

async function getOpenIssueKeysForAudit(supabase: ReturnType<typeof createAdminClient>, auditId: string) {
  const { data, error } = await supabase
    .from("audit_issues")
    .select("code, title, is_resolved, pages(url)")
    .eq("audit_id", auditId);

  if (error) throw error;

  return new Set(
    (data ?? [])
      .filter((issue) => !issue.is_resolved)
      .map((issue) => {
        const pageRelation = issue.pages as unknown as { url?: string } | null;
        return `${issue.code}:${issue.title}:${pageRelation?.url ?? ""}`;
      }),
  );
}

export async function getCrawlIssuesCenterData({
  websiteId,
  crawlId,
  page,
  pageSize = 20,
  severity,
  category,
  status,
  search,
}: {
  websiteId?: string;
  crawlId?: string;
  page: number;
  pageSize?: number;
  severity?: string;
  category?: string;
  status?: string;
  search?: string;
}): Promise<CrawlIssuesCenterData> {
  if (!isSupabaseAdminConfigured()) {
    return {
      configured: false,
      website: null,
      crawl: null,
      audit: null,
      issues: [],
      stats: emptyStats(),
      comparison: {
        previousCrawlId: null,
        resolvedIssues: 0,
        newIssues: 0,
        remainingIssues: 0,
        seoScoreDiff: null,
      },
      pagination: { page, pageSize, total: 0, totalPages: 0 },
    };
  }

  try {
    const supabase = createAdminClient();
    let crawlQuery = supabase
      .from("crawls")
      .select("id, website_id, started_at, completed_at, pages_crawled, issues_found, created_at, websites(id, name, url)")
      .order("created_at", { ascending: false })
      .limit(1);

    if (crawlId) crawlQuery = crawlQuery.eq("id", crawlId);
    if (websiteId) crawlQuery = crawlQuery.eq("website_id", websiteId);

    const { data: crawlRows, error: crawlError } = await crawlQuery;
    if (crawlError) throw crawlError;

    const crawl = crawlRows?.[0] ?? null;
    if (!crawl) {
      return {
        configured: true,
        website: null,
        crawl: null,
        audit: null,
        issues: [],
        stats: emptyStats(),
        comparison: {
          previousCrawlId: null,
          resolvedIssues: 0,
          newIssues: 0,
          remainingIssues: 0,
          seoScoreDiff: null,
        },
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      };
    }

    const resolvedWebsiteId = crawl.website_id as string;
    const websiteRelation = crawl.websites as unknown as { id?: string; name?: string; url?: string } | null;

    const { data: audit, error: auditError } = await supabase
      .from("seo_audits")
      .select("id, score")
      .eq("crawl_id", crawl.id)
      .eq("website_id", resolvedWebsiteId)
      .maybeSingle();
    if (auditError) throw auditError;

    const stats = emptyStats();
    let issueRowsForStats: Array<{ id: string; severity: string; is_resolved: boolean }> = [];

    if (audit) {
      const { data, error } = await supabase
        .from("audit_issues")
        .select("id, severity, is_resolved")
        .eq("audit_id", audit.id);
      if (error) throw error;
      issueRowsForStats = data ?? [];
    }

    for (const issue of issueRowsForStats) {
      const severity = normalizeIssueSeverity(issue.severity);
      stats.total += 1;
      stats[severity] += 1;
      if (issue.is_resolved) stats.resolved += 1;
    }

    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;
    let issues: CrawlIssueCenterItem[] = [];
    let total = 0;

    if (audit) {
      let issueQuery = supabase
        .from("audit_issues")
        .select(
          "id, code, title, description, severity, category, recommendation, is_resolved, created_at, pages(url, title)",
          { count: "exact" },
        )
        .eq("audit_id", audit.id)
        .order("created_at", { ascending: false });

      if (severity && severity !== "all" && severity !== "resolved") {
        const dbSeverity =
          severity === "critical"
            ? "critical"
            : severity === "high"
              ? "critical"
              : severity === "medium"
                ? "warning"
                : "notice";
        issueQuery = issueQuery.eq("severity", dbSeverity);
      }

      if (status === "resolved" || severity === "resolved") {
        issueQuery = issueQuery.eq("is_resolved", true);
      } else {
        issueQuery = issueQuery.eq("is_resolved", false);
      }

      if (category && category !== "all") {
        const categorySearch = category.toLowerCase().replace(/\s+/g, "_");
        issueQuery = issueQuery.or(
          `code.ilike.%${categorySearch}%,title.ilike.%${category}%,description.ilike.%${category}%`,
        );
      }

      if (search) {
        issueQuery = issueQuery.or(
          `code.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%`,
        );
      }

      const { data, error, count } = await issueQuery.range(from, to);

      if (error) throw error;
      total = count ?? 0;
      issues = (data ?? []).map((issue) => {
        const pageRelation = issue.pages as unknown as { url?: string; title?: string } | null;
        const severity = normalizeIssueSeverity(issue.severity);
        const category = inferIssueCategory(issue.code, issue.title);

        return {
          id: issue.id,
          websiteId: resolvedWebsiteId,
          issueType: issue.code,
          category,
          title: issue.title,
          pageUrl: pageRelation?.url ?? null,
          pageTitle: pageRelation?.title ?? null,
          impact: impactFromSeverity(severity),
          severity,
          description: issue.description,
          recommendation: issue.recommendation,
          detectedAt: issue.created_at,
          status: issue.is_resolved ? "resolved" : "open",
        };
      });
    }

    const { data: previousCrawls, error: previousError } = await supabase
      .from("crawls")
      .select("id, issues_found, created_at")
      .eq("website_id", resolvedWebsiteId)
      .lt("created_at", crawl.created_at)
      .order("created_at", { ascending: false })
      .limit(1);
    if (previousError) throw previousError;

    const previousCrawl = previousCrawls?.[0] ?? null;
    let previousScore: number | null = null;
    let resolvedIssues = 0;
    let newIssues = stats.total;
    let remainingIssues = stats.total - stats.resolved;

    if (previousCrawl) {
      const { data: previousAudit } = await supabase
        .from("seo_audits")
        .select("id, score")
        .eq("crawl_id", previousCrawl.id)
        .eq("website_id", resolvedWebsiteId)
        .maybeSingle();
      previousScore = previousAudit?.score ?? null;

      if (previousAudit?.id && audit?.id) {
        const [previousKeys, currentKeys] = await Promise.all([
          getOpenIssueKeysForAudit(supabase, previousAudit.id),
          getOpenIssueKeysForAudit(supabase, audit.id),
        ]);

        resolvedIssues = [...previousKeys].filter((key) => !currentKeys.has(key)).length;
        newIssues = [...currentKeys].filter((key) => !previousKeys.has(key)).length;
        remainingIssues = [...currentKeys].filter((key) => previousKeys.has(key)).length;
      }
    }

    return {
      configured: true,
      website: {
        id: resolvedWebsiteId,
        name: websiteRelation?.name ?? "Website",
        url: websiteRelation?.url ?? "",
      },
      crawl: {
        id: crawl.id,
        startedAt: crawl.started_at,
        completedAt: crawl.completed_at,
        pagesCrawled: crawl.pages_crawled ?? 0,
        issuesFound: crawl.issues_found ?? 0,
        durationSeconds: getDurationSeconds(crawl.started_at, crawl.completed_at),
      },
      audit: audit ? { id: audit.id, score: audit.score } : null,
      issues,
      stats,
      comparison: {
        previousCrawlId: previousCrawl?.id ?? null,
        resolvedIssues,
        newIssues,
        remainingIssues,
        seoScoreDiff:
          previousScore !== null && audit
            ? Number(audit.score ?? 0) - Number(previousScore)
            : null,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("[crawl-issues] Crawl issues could not be loaded:", error);
    return {
      configured: true,
      website: null,
      crawl: null,
      audit: null,
      issues: [],
      stats: emptyStats(),
      comparison: {
        previousCrawlId: null,
        resolvedIssues: 0,
        newIssues: 0,
        remainingIssues: 0,
        seoScoreDiff: null,
      },
      pagination: { page, pageSize, total: 0, totalPages: 0 },
    };
  }
}

export async function getWebsiteCrawlData(websiteId: string): Promise<WebsiteCrawlData> {
  if (!isSupabaseAdminConfigured()) {
    return { pages: [], audit: null, issues: [] };
  }

  try {
    const supabase = createAdminClient();
    const { data: latestCrawl, error: latestCrawlError } = await supabase
      .from("crawls")
      .select("id")
      .eq("website_id", websiteId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestCrawlError) throw latestCrawlError;
    if (!latestCrawl) return { pages: [], audit: null, issues: [] };

    const [{ data: pages, error: pagesError }, { data: audit, error: auditError }] =
      await Promise.all([
        supabase
          .from("pages")
          .select("id, url, status_code, title, meta_description, h1, h2, word_count, seo_score, issues_count, crawled_at")
          .eq("website_id", websiteId)
          .eq("crawl_id", latestCrawl.id)
          .order("crawled_at", { ascending: false })
          .limit(500),
        supabase
          .from("seo_audits")
          .select("id, score, status, summary, completed_at")
          .eq("website_id", websiteId)
          .eq("crawl_id", latestCrawl.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (pagesError) throw pagesError;
    if (auditError) throw auditError;

    let issues: AuditIssueItem[] = [];
    if (audit) {
      const { data: issueRows, error: issuesError } = await supabase
        .from("audit_issues")
        .select("id, title, description, severity, recommendation, pages(url)")
        .eq("audit_id", audit.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (issuesError) throw issuesError;

      issues = (issueRows ?? []).map((issue) => {
        const relation = issue.pages as unknown as { url?: string } | null;
        return {
          id: issue.id,
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          recommendation: issue.recommendation,
          pageUrl: relation?.url ?? null,
        };
      });
    }

    return {
      pages: (pages ?? []).map((page) => ({
        id: page.id,
        url: page.url,
        statusCode: page.status_code,
        title: page.title,
        metaDescription: page.meta_description,
        h1: page.h1,
        h2: page.h2 ?? [],
        wordCount: page.word_count,
        seoScore: page.seo_score,
        issuesCount: page.issues_count,
        crawledAt: page.crawled_at,
      })),
      audit: audit
        ? {
            id: audit.id,
            score: audit.score,
            status: audit.status,
            summary: audit.summary ?? {},
            completedAt: audit.completed_at,
          }
        : null,
      issues,
    };
  } catch (error) {
    console.error(`[crawl-data] Data for ${websiteId} could not be loaded:`, error);
    return { pages: [], audit: null, issues: [] };
  }
}
