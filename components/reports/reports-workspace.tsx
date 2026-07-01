"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  Download,
  Eye,
  FileBarChart,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SeoReport, Website } from "@/types";

const includeOptions = [
  ["crawl", "reports.includeCrawl"] as const,
  ["audit", "reports.includeAudit"] as const,
  ["issues", "reports.includeIssues"] as const,
  ["keywords", "reports.includeKeywords"] as const,
  ["searchConsole", "reports.includeSearchConsole"] as const,
  ["generatedPages", "reports.includeGeneratedPages"] as const,
  ["recommendations", "reports.includeRecommendations"] as const,
  ["plan30", "reports.includePlan30"] as const,
];

const statusLabels = {
  generating: "reports.statusGenerating",
  ready: "reports.statusReady",
  failed: "reports.statusFailed",
} as const;

const statusVariant: Record<SeoReport["status"], "success" | "warning" | "destructive"> = {
  generating: "warning",
  ready: "success",
  failed: "destructive",
};

interface RawReportRow {
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

function mapRawReport(row: RawReportRow): SeoReport {
  return {
    id: row.id,
    websiteId: row.website_id,
    title: row.title,
    type: row.type,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summary: row.summary,
    data: row.data,
    pdfUrl: row.pdf_url,
    downloadsCount: row.downloads_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ReportsWorkspace({
  websites,
  initialWebsiteId,
  initialReports,
  initialError,
}: {
  websites: Website[];
  initialWebsiteId: string;
  initialReports: SeoReport[];
  initialError?: string;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [websiteId, setWebsiteId] = useState(initialWebsiteId);
  const [reports, setReports] = useState(initialReports);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(initialError ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SeoReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [includes, setIncludes] = useState<Record<string, boolean>>(
    Object.fromEntries(includeOptions.map(([key]) => [key, true])),
  );

  const selectedWebsite = useMemo(
    () => websites.find((website) => website.id === websiteId) ?? websites[0],
    [websiteId, websites],
  );
  const websiteLookup = useMemo(() => new Map(websites.map((website) => [website.id, website])), [websites]);
  const totalDownloads = reports.reduce((sum, report) => sum + report.downloadsCount, 0);

  async function generateReport() {
    if (!selectedWebsite || isGenerating) return;
    setIsGenerating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: selectedWebsite.id,
          periodStart,
          periodEnd,
          type: "full_seo",
          includes,
        }),
      });
      const payload = (await response.json()) as { data?: { report: RawReportRow }; error?: string };
      if (!response.ok || payload.error || !payload.data?.report) {
        throw new Error(payload.error ?? t("reports.generateFailed"));
      }

      const report = mapRawReport(payload.data.report);
      setReports((current) => [report, ...current.filter((item) => item.id !== report.id)]);
      setMessage(t("reports.generateSuccess"));
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("reports.generateFailed"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function deleteReport() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(deleteTarget.id)}?websiteId=${encodeURIComponent(deleteTarget.websiteId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteId: deleteTarget.websiteId }),
        },
      );
      const payload = (await response.json()) as { data?: { success: boolean }; error?: string };

      if (!response.ok || payload.error || !payload.data?.success) {
        throw new Error(payload.error ?? t("reports.deleteFailed"));
      }

      setReports((current) => current.filter((report) => report.id !== deleteTarget.id));
      setMessage(t("reports.deleteSuccess"));
      setDeleteTarget(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("reports.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("reports.eyebrow")}</p>
          <h2 className="font-[var(--font-manrope)] text-2xl font-bold tracking-tight sm:text-3xl">{t("reports.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("reports.description")}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("reports.newReport")}
        </Button>
      </div>

      <Card className="p-4">
        <label className="space-y-2 text-sm">
          <span className="text-muted-foreground">Website</span>
          <select
            className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-md"
            value={websiteId}
            onChange={(event) => {
              setWebsiteId(event.target.value);
              router.push(`/reports?websiteId=${encodeURIComponent(event.target.value)}`);
            }}
          >
            {websites.map((website) => (
              <option key={website.id} value={website.id}>{website.name} - {website.url.replace(/^https?:\/\//, "")}</option>
            ))}
          </select>
        </label>
      </Card>

      {message ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <FileBarChart className="size-5 text-primary" />
          <p className="mt-4 text-2xl font-bold">{reports.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("reports.generatedReports")}</p>
        </Card>
        <Card className="p-5">
          <CalendarDays className="size-5 text-success" />
          <p className="mt-4 text-2xl font-bold">0</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("reports.scheduledReports")}</p>
        </Card>
        <Card className="p-5">
          <Download className="size-5 text-warning" />
          <p className="mt-4 text-2xl font-bold">{totalDownloads}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("reports.realDownloads")}</p>
        </Card>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("reports.emptyTitle")}
          description={t("reports.emptyDescription")}
          action={t("reports.newReport")}
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const website = websiteLookup.get(report.websiteId);
            return (
              <Card key={report.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{report.title}</h3>
                    <Badge variant={statusVariant[report.status]}>{t(statusLabels[report.status])}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {website?.name ?? "Website"} · {formatDate(report.periodStart, locale)} - {formatDate(report.periodEnd, locale)} · {formatDateTime(report.createdAt, locale)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {report.summary ?? t("reports.unavailable")}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/reports/${report.id}?websiteId=${encodeURIComponent(report.websiteId)}`}>
                      <Eye className="size-4" />
                      {t("reports.viewReport")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" aria-disabled={!report.pdfUrl || report.status !== "ready"}>
                    {report.pdfUrl && report.status === "ready" ? (
                      <a href={`/api/reports/download?id=${encodeURIComponent(report.id)}`}>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(report)}
                  >
                    <Trash2 className="size-4" />
                    {t("reports.delete")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold">{t("reports.newModalTitle")}</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                  {t("reports.newModalDescription")}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" disabled={isGenerating}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm sm:col-span-2">
                <span className="text-muted-foreground">{t("content.website")}</span>
                <select
                  className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={websiteId}
                  onChange={(event) => setWebsiteId(event.target.value)}
                >
                  {websites.map((website) => <option key={website.id} value={website.id}>{website.name}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("reports.periodStart")}</span>
                <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("reports.periodEnd")}</span>
                <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
              </label>
              <label className="space-y-2 text-sm sm:col-span-2">
                <span className="text-muted-foreground">{t("reports.reportType")}</span>
                <select className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value="full_seo" disabled>
                  <option value="full_seo">{t("reports.fullSeo")}</option>
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-xl border bg-secondary/20 p-4">
              <p className="text-sm font-semibold">{t("reports.include")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {includeOptions.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={includes[key]}
                      onChange={(event) => setIncludes((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    {t(label)}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={isGenerating}>{t("content.cancel")}</Button>
              </Dialog.Close>
              <Button onClick={generateReport} disabled={isGenerating || !websiteId || !periodStart || !periodEnd}>
                {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <FileBarChart className="size-4" />}
                {t("reports.generatePdf")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={Boolean(deleteTarget)} onOpenChange={(nextOpen) => {
        if (!nextOpen && !isDeleting) setDeleteTarget(null);
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold">{t("reports.deleteModalTitle")}</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("reports.deleteModalDescription")}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" disabled={isDeleting}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>

            {deleteTarget ? (
              <div className="mt-5 rounded-xl border bg-secondary/20 p-4">
                <p className="text-sm font-semibold">{deleteTarget.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(deleteTarget.periodStart, locale)} - {formatDate(deleteTarget.periodEnd, locale)}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={isDeleting}>{t("content.cancel")}</Button>
              </Dialog.Close>
              <Button variant="destructive" onClick={deleteReport} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {t("reports.deleteReport")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
