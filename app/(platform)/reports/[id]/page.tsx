import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerTranslator } from "@/lib/i18n/server";
import { getReportById } from "@/lib/supabase/reports";
import { getWebsiteById } from "@/lib/supabase/websites";
import { getOwnedWebsiteForCurrentUser } from "@/lib/supabase/website-access";

export const dynamic = "force-dynamic";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function metric(value: unknown, unavailable: string) {
  if (value === null || value === undefined || value === "") return unavailable;
  return String(value);
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getServerTranslator();
  const report = await getReportById(id);

  if (!report) {
    return (
      <EmptyState
        icon={FileText}
        title={t("reportDetail.notFound")}
        description={t("reportDetail.notFoundDescription")}
        action={t("reportDetail.backToReports")}
        actionHref="/reports"
      />
    );
  }

  try {
    await getOwnedWebsiteForCurrentUser(report.websiteId);
  } catch {
    return (
      <EmptyState
        icon={FileText}
        title={t("reportDetail.noAccess")}
        description={t("reportDetail.noAccessDescription")}
        action={t("reportDetail.backToReports")}
        actionHref="/reports"
      />
    );
  }

  const website = await getWebsiteById(report.websiteId);
  const data = asRecord(report.data);
  const metrics = asRecord(data.metrics);
  const crawl = asRecord(data.crawl);
  const audit = asRecord(data.audit);
  const keywords = asRecord(data.keywords);
  const content = asRecord(data.content);
  const searchConsole = asRecord(data.searchConsole);
  const recommendations = asArray(data.recommendations);
  const actionPlan = Array.isArray(data.actionPlan) ? data.actionPlan.map(String) : [];
  const unavailable = t("reports.unavailable");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("reportDetail.eyebrow")}
        title={report.title}
        description={`${website?.name ?? "Website"} · ${formatDate(report.periodStart, locale)} - ${formatDate(report.periodEnd, locale)} · ${t("reportDetail.generatedAt")} ${formatDateTime(report.createdAt, locale)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/reports?websiteId=${encodeURIComponent(report.websiteId)}`}>
                <ArrowLeft className="size-4" />
                {t("reportDetail.backToReports")}
              </Link>
            </Button>
            <Button asChild disabled={!report.pdfUrl || report.status !== "ready"}>
              {report.pdfUrl && report.status === "ready" ? (
                <a href={`/api/reports/download?id=${encodeURIComponent(report.id)}&websiteId=${encodeURIComponent(report.websiteId)}`}>
                  <Download className="size-4" />
                  {t("reports.downloadPdf")}
                </a>
              ) : (
                <span>
                  <Download className="size-4" />
                  {t("reports.pdfGenerating")}
                </span>
              )}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="SEO Score" value={metric(metrics.seoScore, unavailable)} />
        <MetricCard label={t("reportDetail.pagesAnalyzed")} value={metric(metrics.pagesAnalyzed, unavailable)} />
        <MetricCard label={t("reportDetail.detectedIssues")} value={metric(metrics.issuesDetected, unavailable)} />
        <MetricCard label={t("reportDetail.clicks")} value={metric(metrics.clicks, unavailable)} />
      </div>

      <ReportSection title={t("reportDetail.executiveSummary")}>
        <p>{report.summary ?? unavailable}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{t("reportDetail.critical")}: {metric(metrics.criticalIssues, unavailable)}</Badge>
          <Badge variant="warning">{t("reportDetail.medium")}: {metric(metrics.mediumIssues, unavailable)}</Badge>
          <Badge variant="outline">{t("reportDetail.low")}: {metric(metrics.lowIssues, unavailable)}</Badge>
        </div>
      </ReportSection>

      <ReportSection title={t("reportDetail.crawlSeo")}>
        <p>{t("reportDetail.latestCrawl")}: {metric(asRecord(crawl.latest).created_at, unavailable)}</p>
        <p>{t("reportDetail.crawledPages")}: {metric(asRecord(crawl.latest).pages_crawled, unavailable)}</p>
      </ReportSection>

      <ReportSection title={t("reportDetail.auditSeo")}>
        <p>{t("reportDetail.auditStatus")}: {metric(asRecord(audit.latest).status, unavailable)}</p>
        <p>{t("reportDetail.auditScore")}: {metric(asRecord(audit.latest).score, unavailable)}</p>
      </ReportSection>

      <ReportSection title={t("reportDetail.priorityIssues")}>
        <SimpleList unavailable={unavailable} items={asArray(audit.issues).slice(0, 10).map((issue) => String(issue.title ?? t("reportDetail.seoIssue")))} />
      </ReportSection>

      <ReportSection title="Keyword Research">
        <SimpleList unavailable={unavailable} items={asArray(keywords.research).slice(0, 10).map((item) => String(item.keyword ?? "Keyword"))} />
      </ReportSection>

      <ReportSection title="Search Console">
        {Object.keys(searchConsole).length ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label={t("reportDetail.impressions")} value={metric(metrics.impressions, unavailable)} />
            <MetricCard label="CTR" value={metric(metrics.ctr, unavailable)} />
            <MetricCard label={t("reportDetail.averagePosition")} value={metric(metrics.averagePosition, unavailable)} />
            <MetricCard label={t("reportDetail.indexedPages")} value={metric(metrics.pagesIndexed, unavailable)} />
          </div>
        ) : (
          <p>{t("reportDetail.integrationNotConnected")}</p>
        )}
      </ReportSection>

      <ReportSection title={t("reportDetail.generatedContent")}>
        <p>{t("reportDetail.generatedPages")}: {asArray(content.generatedPages).length}</p>
        <p>{t("reportDetail.editorialPlans")}: {asArray(content.plans).length}</p>
      </ReportSection>

      <ReportSection title={t("reportDetail.aiRecommendations")}>
        <p>{t("reportDetail.prioritizedRecommendations")}: {recommendations.length}</p>
      </ReportSection>

      <ReportSection title={t("reportDetail.actionPlan30")}>
        <SimpleList unavailable={unavailable} items={actionPlan} ordered />
      </ReportSection>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </Card>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="font-[var(--font-manrope)] text-lg font-bold">{title}</h3>
      <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </Card>
  );
}

function SimpleList({ items, ordered = false, unavailable }: { items: string[]; ordered?: boolean; unavailable: string }) {
  if (!items.length) return <p>{unavailable}</p>;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className={ordered ? "list-inside list-decimal" : "flex gap-2"}>
          {ordered ? item : <><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /> <span>{item}</span></>}
        </li>
      ))}
    </Tag>
  );
}
