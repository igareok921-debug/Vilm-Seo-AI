import "server-only";

import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import type { SeoIssue, Website } from "@/types";

export interface AuditSummaryData {
  configured: boolean;
  website: Website | null;
  audit: {
    id: string;
    crawlId: string | null;
    score: number;
    completedAt: string | null;
    summary: {
      criticalIssues?: number;
      warnings?: number;
      passedChecks?: number;
      pages?: number;
      issues?: number;
    };
  } | null;
  latestCompletedCrawl: {
    id: string;
    createdAt: string;
    pagesCrawled: number;
    issuesFound: number;
  } | null;
  issues: SeoIssue[];
}

type DbSeverity = "critical" | "warning" | "notice";

function severityLabel(severity: string | null | undefined): SeoIssue["severity"] {
  if (severity === "critical" || severity === "Critică") return "Critical";
  if (severity === "warning" || severity === "Medie") return "Medium";
  return "Low";
}

function supportedIssueType(code: string): SeoIssue["issueType"] {
  const supported: SeoIssue["issueType"][] = [
    "missing_meta_description",
    "short_meta_description",
    "missing_title",
    "short_title",
    "images_without_alt",
    "duplicate_titles",
    "missing_h1",
    "thin_content",
    "slow_pages",
  ];

  return supported.includes(code as SeoIssue["issueType"])
    ? (code as SeoIssue["issueType"])
    : "thin_content";
}

function impactFromSeverity(severity: DbSeverity | string | null | undefined) {
  if (severity === "critical" || severity === "Critică") return "High impact on indexing or conversion.";
  if (severity === "warning" || severity === "Medie") return "Medium impact on CTR and relevance.";
  return "Low impact, but useful for technical quality.";
}

function severityOrder(severity: SeoIssue["severity"]) {
  if (severity === "Critical" || severity === "Critică") return 0;
  if (severity === "Medium" || severity === "Medie") return 1;
  return 2;
}

export async function getLatestAuditData(websiteId?: string): Promise<AuditSummaryData> {
  if (!websiteId || !isSupabaseAdminConfigured()) {
    return {
      configured: isSupabaseAdminConfigured(),
      website: null,
      audit: null,
      latestCompletedCrawl: null,
      issues: [],
    };
  }

  try {
    const supabase = createAdminClient();
    const [websiteResult, crawlResult] = await Promise.all([
      supabase
        .from("websites")
        .select("id, name, url, language, niche, seo_score, pages_count, keywords_count, status, last_audit_at, created_at")
        .eq("id", websiteId)
        .maybeSingle(),
      supabase
        .from("crawls")
        .select("id, created_at, pages_crawled, issues_found")
        .eq("website_id", websiteId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (websiteResult.error) throw websiteResult.error;
    if (crawlResult.error) throw crawlResult.error;

    let auditResult = await supabase
      .from("seo_audits")
      .select("id, crawl_id, score, completed_at, summary")
      .eq("website_id", websiteId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (crawlResult.data?.id) {
      auditResult = await supabase
        .from("seo_audits")
        .select("id, crawl_id, score, completed_at, summary")
        .eq("website_id", websiteId)
        .eq("crawl_id", crawlResult.data.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (auditResult.error) throw auditResult.error;

    const websiteRow = websiteResult.data;
    const audit = auditResult.data;
    let issues: SeoIssue[] = [];

    if (audit) {
      const { data: issueRows, error: issuesError } = await supabase
        .from("audit_issues")
        .select("id, code, title, description, severity, recommendation, is_resolved")
        .eq("audit_id", audit.id)
        .order("severity", { ascending: true })
        .limit(500);

      if (issuesError) throw issuesError;

      const grouped = new Map<string, SeoIssue>();
      for (const issue of issueRows ?? []) {
        const key = `${issue.code}:${issue.title}:${issue.severity}:${issue.is_resolved ? "resolved" : "open"}`;
        const current = grouped.get(key);
        if (current) {
          current.count += 1;
          continue;
        }

        grouped.set(key, {
          id: issue.id,
          issueId: issue.id,
          websiteId,
          issueType: supportedIssueType(issue.code),
          title: issue.title,
          website: websiteRow?.url ? new URL(websiteRow.url).hostname.replace(/^www\./, "") : websiteRow?.name ?? "Website",
          severity: severityLabel(issue.severity),
          count: 1,
          description: issue.description ?? "Issue detected in the SEO audit.",
          recommendation: issue.recommendation ?? "Review the affected page and apply the recommended fix.",
          impact: impactFromSeverity(issue.severity),
          status: issue.is_resolved ? "resolved" : "open",
        });
      }

      issues = Array.from(grouped.values()).sort((a, b) => {
        return severityOrder(a.severity) - severityOrder(b.severity) || b.count - a.count;
      });
    }

    return {
      configured: true,
      website: websiteRow
        ? {
            id: websiteRow.id,
            name: websiteRow.name,
            url: websiteRow.url,
            language: websiteRow.language,
            niche: websiteRow.niche,
            score: websiteRow.seo_score,
            pages: websiteRow.pages_count,
            keywords: websiteRow.keywords_count,
            status: websiteRow.status,
            lastAudit: websiteRow.last_audit_at ?? websiteRow.created_at,
          }
        : null,
      audit: audit
        ? {
            id: audit.id,
            crawlId: audit.crawl_id,
            score: Number(audit.score ?? 0),
            completedAt: audit.completed_at,
            summary: audit.summary ?? {},
          }
        : null,
      latestCompletedCrawl: crawlResult.data
        ? {
            id: crawlResult.data.id,
            createdAt: crawlResult.data.created_at,
            pagesCrawled: crawlResult.data.pages_crawled ?? 0,
            issuesFound: crawlResult.data.issues_found ?? 0,
          }
        : null,
      issues,
    };
  } catch (error) {
    console.error("[audit-data] Audit could not be loaded:", error);
    return {
      configured: true,
      website: null,
      audit: null,
      latestCompletedCrawl: null,
      issues: [],
    };
  }
}
