import { NextResponse } from "next/server";
import { generateReportPdfBuffer } from "@/lib/reports/pdf-generator";
import {
  collectReportSnapshot,
  saveReportPdf,
} from "@/lib/supabase/reports";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import type { createAdminClient } from "@/lib/supabase/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse, logSupabaseError } from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";

export const maxDuration = 180;
export const runtime = "nodejs";

interface ReportGenerateBody {
  websiteId?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  type?: unknown;
  includes?: unknown;
}

const includeKeys = [
  "crawl",
  "audit",
  "issues",
  "keywords",
  "searchConsole",
  "generatedPages",
  "recommendations",
  "plan30",
];

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIncludes(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(includeKeys.map((key) => [key, source[key] !== false]));
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured. The PDF report cannot be saved." },
      { status: 503 },
    );
  }

  let body: ReportGenerateBody;
  try {
    body = (await request.json()) as ReportGenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const websiteId = getString(body.websiteId);
  const periodStart = getString(body.periodStart);
  const periodEnd = getString(body.periodEnd);
  const type = getString(body.type) || "full_seo";
  const includes = normalizeIncludes(body.includes);

  if (!websiteId || !periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "websiteId, periodStart, and periodEnd are required." },
      { status: 422 },
    );
  }

  let reportId: string | null = null;
  let supabaseForFailure: ReturnType<typeof createAdminClient> | null = null;

  try {
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    const { supabase, website, organizationId, workspace } = access;
    await checkUsageLimit({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "report.generated",
    });

    supabaseForFailure = supabase;
    const title = `Complete SEO Report - ${website.name}`;

    const { data: created, error: createError } = await supabase
      .from("reports")
      .insert({
        website_id: websiteId,
        title,
        type,
        status: "generating",
        period_start: periodStart,
        period_end: periodEnd,
        summary: "The report is being generated.",
        data: {},
      })
      .select("id")
      .single();

    if (createError || !created?.id) {
      return NextResponse.json(
        { error: "The report could not be initialized. Contact support if the problem persists." },
        { status: 500 },
      );
    }

    reportId = created.id as string;
    const snapshot = await collectReportSnapshot({ website, periodStart, periodEnd, includes });
    const pdfBuffer = await generateReportPdfBuffer(snapshot);
    const pdfUrl = await saveReportPdf({ reportId, websiteId, pdfBuffer });
    const summary = `SEO Score ${snapshot.metrics.seoScore ?? "N/A"}, ${snapshot.metrics.pagesAnalyzed} analyzed pages, ${snapshot.metrics.issuesDetected} detected issues.`;

    const { data, error } = await supabase
      .from("reports")
      .update({
        status: "ready",
        summary,
        data: snapshot,
        pdf_url: pdfUrl,
      })
      .eq("id", reportId)
      .eq("website_id", websiteId)
      .select("id, website_id, title, type, status, period_start, period_end, summary, data, pdf_url, downloads_count, created_at, updated_at")
      .single();

    if (error) throw error;

    await supabase.from("activity_logs").insert({
      website_id: websiteId,
      action: "report.generated",
      description: `PDF report generated: ${title}`,
      metadata: { report_id: reportId, pdf_url: pdfUrl },
    });

    await recordUsageEvent({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "report.generated",
      metadata: { report_id: reportId, type, period_start: periodStart, period_end: periodEnd },
    });

    return NextResponse.json({ data: { report: data } });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    const usageError = getUsageLimitErrorResponse(error);
    if (usageError) return usageError;
    logSupabaseError("[reports/generate] Report could not be generated:", error);
    if (reportId && supabaseForFailure) {
      await supabaseForFailure
        .from("reports")
        .update({
          status: "failed",
          summary: "The PDF report could not be generated.",
        })
        .eq("id", reportId)
        .eq("website_id", websiteId);
    }

    return NextResponse.json(
      { error: "The PDF report could not be generated. Check the data and try again." },
      { status: 500 },
    );
  }
}
