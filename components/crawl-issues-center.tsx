"use client";

import {
  CheckCircle2,
  Eye,
  FileSearch,
  Loader2,
  Search,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  CrawlIssuesCenterData,
  CrawlIssueSeverity,
  CrawlIssueStatus,
} from "@/lib/supabase/crawl-data";

const categoryFilters = [
  "Meta Description",
  "Title",
  "H1",
  "Images",
  "ALT",
  "Internal Links",
  "External Links",
  "Schema",
  "Performance",
  "Canonical",
  "Robots",
  "OpenGraph",
  "Twitter Cards",
  "EEAT",
  "Content",
];

const severityVariant: Record<CrawlIssueSeverity, "destructive" | "warning" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "warning",
  low: "outline",
};

export function CrawlIssuesCenter({
  data,
  initialShowComparison = false,
}: {
  data: CrawlIssuesCenterData;
  initialShowComparison?: boolean;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localStatuses, setLocalStatuses] = useState<Record<string, CrawlIssueStatus>>({});
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(initialShowComparison);
  const [isPending, startTransition] = useTransition();

  const selectedIssueIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const severityFilters = useMemo(() => [
    { label: t("crawl.all"), value: "all" },
    { label: t("crawl.critical"), value: "critical" },
    { label: t("crawl.high"), value: "high" },
    { label: t("crawl.medium"), value: "medium" },
    { label: t("crawl.low"), value: "low" },
    { label: t("crawl.resolved"), value: "resolved" },
  ], [t]);
  const severityLabels: Record<CrawlIssueSeverity, string> = {
    critical: t("crawl.critical"),
    high: t("crawl.high"),
    medium: t("crawl.medium"),
    low: t("crawl.low"),
  };
  const statusLabels: Record<CrawlIssueStatus, string> = {
    open: t("crawl.open"),
    resolved: t("crawl.resolved"),
    ignored: t("crawl.ignored"),
  };

  function buildUrl(next: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, String(value));
    }

    return `/crawl/issues?${params.toString()}`;
  }

  function updateFilter(key: string, value: string) {
    startTransition(() => {
      router.push(buildUrl({ [key]: value, page: 1 }));
    });
  }

  function toggleIssue(issueId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) =>
      current.size === data.issues.length ? new Set() : new Set(data.issues.map((issue) => issue.id)),
    );
  }

  async function updateStatus(issueIds: string[], status: "resolved" | "ignored") {
    if (!data.website || issueIds.length === 0) return;
    setLoadingLabel(status === "ignored" ? t("crawl.ignoring") : t("crawl.marking"));
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/crawl/issues/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueIds,
          websiteId: data.website.id,
          action: status,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("crawl.statusUpdateFailed"));

      setLocalStatuses((current) => ({
        ...current,
        ...Object.fromEntries(issueIds.map((id) => [id, status])),
      }));
      setSelectedIds(new Set());
      setMessage(status === "ignored" ? t("crawl.ignoredSuccess") : t("crawl.resolvedSuccess"));
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : t("crawl.statusUpdateFailed"));
    } finally {
      setLoadingLabel(null);
    }
  }

  if (!data.configured) {
    return (
      <EmptyState
        icon={FileSearch}
        title={t("crawl.supabaseNotConfigured")}
        description={t("crawl.supabaseIssuesDescription")}
      />
    );
  }

  if (!data.crawl) {
    return (
      <EmptyState
        icon={FileSearch}
        title={t("crawl.noSelectedCrawl")}
        description={t("crawl.noSelectedCrawlDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[88px] z-10 rounded-2xl border bg-card/95 p-4 shadow-lg shadow-black/10 backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">{t("crawl.search")}</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t("crawl.searchPlaceholder")}
                defaultValue={searchParams.get("search") ?? ""}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    updateFilter("search", event.currentTarget.value);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {severityFilters.map((filter) => {
              const active = (searchParams.get("severity") ?? "all") === filter.value;
              return (
                <Button
                  key={filter.value}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => updateFilter("severity", filter.value)}
                >
                  {filter.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={!searchParams.get("category") ? "default" : "outline"}
            onClick={() => updateFilter("category", "all")}
          >
            {t("crawl.allCategories")}
          </Button>
          {categoryFilters.map((category) => (
            <Button
              key={category}
              size="sm"
              variant={searchParams.get("category") === category ? "default" : "outline"}
              onClick={() => updateFilter("category", category)}
              className="shrink-0"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {t("crawl.selectAll")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              title={t("crawl.fixSoonTitle")}
            >
              {t("crawl.metaSoon")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              title={t("crawl.previewSoonTitle")}
            >
              {t("crawl.altSoon")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              title={t("crawl.previewSoonTitle")}
            >
              {t("crawl.h1Soon")}
            </Button>
            <Button
              size="sm"
              disabled={selectedIssueIds.length === 0}
              onClick={() => updateStatus(selectedIssueIds, "resolved")}
            >
              {t("crawl.resolveSelected")}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowComparison((value) => !value)}>
            {t("crawl.comparePrevious")}
          </Button>
        </div>

        {showComparison ? (
          data.comparison.previousCrawlId ? (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">{t("crawl.resolvedIssues")}</p>
                <p className="mt-2 text-2xl font-bold">{data.comparison.resolvedIssues}</p>
              </div>
              <div className="rounded-xl border bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">{t("crawl.newIssues")}</p>
                <p className="mt-2 text-2xl font-bold">{data.comparison.newIssues}</p>
              </div>
              <div className="rounded-xl border bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">{t("crawl.remainingIssues")}</p>
                <p className="mt-2 text-2xl font-bold">{data.comparison.remainingIssues}</p>
              </div>
              <div className="rounded-xl border bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">{t("crawl.scoreDiff")}</p>
                <p className="mt-2 text-2xl font-bold">
                  {data.comparison.seoScoreDiff === null ? "N/A" : `${data.comparison.seoScoreDiff > 0 ? "+" : ""}${data.comparison.seoScoreDiff}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              {t("crawl.noPrevious")}
            </div>
          )
        ) : null}

        {loadingLabel ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
            <Loader2 className="size-4 animate-spin" />
            {loadingLabel}
          </div>
        ) : null}
        {message ? <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{message}</div> : null}
        {error ? <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      </Card>

      {data.issues.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={t("crawl.noIssuesDetected")}
          description={t("crawl.noIssuesDescription")}
        />
      ) : (
        <div className="space-y-3">
          {data.issues.map((issue) => {
            const status = localStatuses[issue.id] ?? issue.status;

            return (
              <Card key={issue.id} className={cn("p-5", status !== "open" && "opacity-75")}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(issue.id)}
                    onChange={() => toggleIssue(issue.id)}
                    className="mt-1 size-4 accent-primary"
                    aria-label={t("crawl.selectIssue")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{issue.category}</Badge>
                      <Badge variant={severityVariant[issue.severity]}>
                        {severityLabels[issue.severity]}
                      </Badge>
                      <Badge variant={status === "resolved" ? "success" : status === "ignored" ? "outline" : "warning"}>
                        {statusLabels[status]}
                      </Badge>
                    </div>
                    <h3 className="mt-3 text-base font-semibold">{issue.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {issue.description ?? t("crawl.defaultIssueDescription")}
                    </p>
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-xl border bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">{t("crawl.affectedPage")}</p>
                        <p className="mt-1 truncate font-medium">{issue.pageTitle ?? issue.pageUrl ?? "N/A"}</p>
                        {issue.pageUrl ? <p className="mt-1 truncate text-xs text-primary">{issue.pageUrl}</p> : null}
                      </div>
                      <div className="rounded-xl border bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">{t("crawl.seoImpact")}</p>
                        <p className="mt-1">{issue.impact}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t("crawl.detectedAt")} {new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(issue.detectedAt))}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:w-44 xl:grid-cols-1">
                    <Button variant="outline" size="sm" asChild disabled={!issue.pageUrl}>
                      <Link href={issue.pageUrl ?? "#"} target="_blank">
                        <Eye className="size-4" />
                        {t("crawl.viewPage")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      disabled
                      title={t("crawl.fixSoonTitle")}
                    >
                      <Wrench className="size-4" />
                      {t("crawl.fixSoon")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      title={t("crawl.previewSoonTitle")}
                    >
                      {t("crawl.previewSoon")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus([issue.id], "ignored")}>
                      {t("crawl.ignore")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateStatus([issue.id], "resolved")}>
                      {t("crawl.markResolved")}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={data.pagination.page <= 1 || isPending}
            onClick={() => startTransition(() => router.push(buildUrl({ page: data.pagination.page - 1 })))}
          >
            {t("crawl.previousPage")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("crawl.page")} {data.pagination.page} {t("crawl.from")} {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={data.pagination.page >= data.pagination.totalPages || isPending}
            onClick={() => startTransition(() => router.push(buildUrl({ page: data.pagination.page + 1 })))}
          >
            {t("crawl.nextPage")}
          </Button>
        </div>
      ) : null}

    </div>
  );
}
