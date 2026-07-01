import { NextResponse } from "next/server";
import { getSeoIssueCopy } from "@/lib/seo/issue-copy";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
} from "@/lib/supabase/website-access";

interface AuditRunRequest {
  websiteId?: unknown;
}

interface SourceIssue {
  page_id: string | null;
  code: string;
  title: string;
  description: string | null;
  severity: "critical" | "warning" | "notice";
  category: string;
  recommendation: string | null;
  is_resolved?: boolean;
}

function issueWeight(severity: string) {
  if (severity === "critical") return 8;
  if (severity === "warning") return 4;
  return 2;
}

function calculateScore(pageScores: number[], issues: SourceIssue[]) {
  const pageAverage = pageScores.length
    ? Math.round(pageScores.reduce((total, score) => total + score, 0) / pageScores.length)
    : 100;
  const penalty = Math.min(45, issues.reduce((total, issue) => total + issueWeight(issue.severity), 0));
  return Math.max(0, Math.min(100, pageAverage - penalty));
}

function groupIssues(issues: SourceIssue[]) {
  const grouped = new Map<string, {
    issueType: string;
    title: string;
    severity: string;
    count: number;
    impact: string;
  }>();

  for (const issue of issues) {
    const key = `${issue.code}:${issue.title}:${issue.severity}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, {
      issueType: issue.code,
      title: issue.title,
      severity: issue.severity,
      count: 1,
      impact:
        issue.severity === "critical"
          ? "High"
          : issue.severity === "warning"
            ? "Medium"
            : "Low",
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, notice: 2 };
    return order[a.severity] - order[b.severity] || b.count - a.count;
  });
}

function deriveIssuesFromPages(pages: Array<{
  id: string;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  word_count: number | null;
  images_without_alt: number | null;
}>): SourceIssue[] {
  const issues: SourceIssue[] = [];

  for (const page of pages) {
    if (!page.title) {
      const copy = getSeoIssueCopy("missing_title");
      issues.push({
        page_id: page.id,
        code: "missing_title",
        title: copy.title,
        description: copy.description,
        severity: "critical",
        category: "on_page",
        recommendation: copy.recommendation,
      });
    } else if (page.title.length < 30) {
      const copy = getSeoIssueCopy("short_title", { titleLength: page.title.length });
      issues.push({
        page_id: page.id,
        code: "short_title",
        title: copy.title,
        description: copy.description,
        severity: "warning",
        category: "on_page",
        recommendation: copy.recommendation,
      });
    }

    if (!page.meta_description) {
      const copy = getSeoIssueCopy("missing_meta_description");
      issues.push({
        page_id: page.id,
        code: "missing_meta_description",
        title: copy.title,
        description: copy.description,
        severity: "warning",
        category: "on_page",
        recommendation: copy.recommendation,
      });
    } else if (page.meta_description.length < 70) {
      const copy = getSeoIssueCopy("short_meta_description", { metaDescriptionLength: page.meta_description.length });
      issues.push({
        page_id: page.id,
        code: "short_meta_description",
        title: copy.title,
        description: copy.description,
        severity: "notice",
        category: "on_page",
        recommendation: copy.recommendation,
      });
    }

    if (!page.h1) {
      const copy = getSeoIssueCopy("missing_h1");
      issues.push({
        page_id: page.id,
        code: "missing_h1",
        title: copy.title,
        description: copy.description,
        severity: "critical",
        category: "on_page",
        recommendation: copy.recommendation,
      });
    }

    if (Number(page.images_without_alt ?? 0) > 0) {
      const copy = getSeoIssueCopy("images_without_alt", { imagesWithoutAlt: page.images_without_alt });
      issues.push({
        page_id: page.id,
        code: "images_without_alt",
        title: copy.title,
        description: copy.description,
        severity: "warning",
        category: "on_page",
        recommendation: copy.recommendation,
      });
    }

    if (Number(page.word_count ?? 0) < 250) {
      const copy = getSeoIssueCopy("thin_content", { wordCount: page.word_count });
      issues.push({
        page_id: page.id,
        code: "thin_content",
        title: copy.title,
        description: copy.description,
        severity: "warning",
        category: "on_page",
        recommendation: copy.recommendation,
      });
    }
  }

  return issues;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured for running audits." },
      { status: 503 },
    );
  }

  let body: AuditRunRequest;
  try {
    body = (await request.json()) as AuditRunRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  try {
    const { supabase } = await getOwnedWebsiteForCurrentUser(websiteId);

    const { data: crawl, error: crawlError } = await supabase
      .from("crawls")
      .select("id, pages_crawled, issues_found, created_at")
      .eq("website_id", websiteId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (crawlError) throw crawlError;
    if (!crawl) {
      return NextResponse.json(
        {
          error: "No completed crawl exists. Run a crawl first.",
          code: "NO_COMPLETED_CRAWL",
        },
        { status: 409 },
      );
    }

    const [{ data: pages, error: pagesError }, { data: sourceAudit, error: sourceAuditError }] =
      await Promise.all([
        supabase
          .from("pages")
          .select("id, title, meta_description, h1, word_count, images_without_alt, seo_score")
          .eq("website_id", websiteId)
          .eq("crawl_id", crawl.id)
          .order("crawled_at", { ascending: false })
          .limit(500),
        supabase
          .from("seo_audits")
          .select("id")
          .eq("website_id", websiteId)
          .eq("crawl_id", crawl.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (pagesError) throw pagesError;
    if (sourceAuditError) throw sourceAuditError;

    let sourceIssues: SourceIssue[] = [];
    if (sourceAudit) {
      const { data: issueRows, error: sourceIssuesError } = await supabase
        .from("audit_issues")
        .select("page_id, code, title, description, severity, category, recommendation, is_resolved")
        .eq("audit_id", sourceAudit.id);

      if (sourceIssuesError) throw sourceIssuesError;
      sourceIssues = (issueRows ?? []).filter((issue) => !issue.is_resolved) as SourceIssue[];
    }

    if (sourceIssues.length === 0) {
      sourceIssues = deriveIssuesFromPages(pages ?? []);
    }

    const pageScores = (pages ?? [])
      .map((page) => Number(page.seo_score ?? 0))
      .filter((score) => Number.isFinite(score) && score > 0);
    const seoScore = calculateScore(pageScores, sourceIssues);
    const criticalIssues = sourceIssues.filter((issue) => issue.severity === "critical").length;
    const warnings = sourceIssues.filter((issue) => issue.severity !== "critical").length;
    const totalChecks = Math.max(1, Number(crawl.pages_crawled ?? pages?.length ?? 0) * 7);
    const passedChecks = Math.max(0, totalChecks - sourceIssues.length);
    const prioritizedIssues = groupIssues(sourceIssues);
    const completedAt = new Date().toISOString();

    const { data: audit, error: auditInsertError } = await supabase
      .from("seo_audits")
      .insert({
        website_id: websiteId,
        crawl_id: crawl.id,
        score: seoScore,
        status: "completed",
        summary: {
          pages: Number(crawl.pages_crawled ?? pages?.length ?? 0),
          issues: sourceIssues.length,
          criticalIssues,
          warnings,
          passedChecks,
          prioritizedIssues,
          generatedFromCrawlId: crawl.id,
        },
        completed_at: completedAt,
      })
      .select("id")
      .single();

    if (auditInsertError) throw auditInsertError;

    if (sourceIssues.length) {
      const { error: issuesInsertError } = await supabase.from("audit_issues").insert(
        sourceIssues.map((issue) => ({
          audit_id: audit.id,
          page_id: issue.page_id,
          code: issue.code,
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          category: issue.category,
          recommendation: issue.recommendation,
          is_resolved: false,
        })),
      );

      if (issuesInsertError) throw issuesInsertError;
    }

    await Promise.all([
      supabase
        .from("websites")
        .update({
          seo_score: seoScore,
          status: criticalIssues > 0 || warnings > 0 ? "Attention" : "Active",
          last_audit_at: completedAt,
        })
        .eq("id", websiteId),
      supabase.from("activity_logs").insert({
        website_id: websiteId,
        action: "audit.completed",
        description: `SEO audit completed: ${sourceIssues.length} active issues.`,
        metadata: {
          audit_id: audit.id,
          crawl_id: crawl.id,
          score: seoScore,
          criticalIssues,
          warnings,
          passedChecks,
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        auditId: audit.id,
        crawlId: crawl.id,
        seoScore,
        criticalIssues,
        warnings,
        passedChecks,
        prioritizedIssues,
      },
    });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[audit-run] Audit could not be run:", error);
    return NextResponse.json({ error: "The audit could not be run." }, { status: 500 });
  }
}
