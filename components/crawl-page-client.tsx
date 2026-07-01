"use client";

import { AlertTriangle, CalendarDays, CheckCircle2, SearchCode } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CrawlRunner } from "@/components/crawl-runner";
import { CrawlRowActions } from "@/components/crawl-row-actions";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CrawlOverview, RecentCrawl } from "@/lib/supabase/crawl-data";
import { formatDate } from "@/lib/utils";
import type { CrawlProgress, Website } from "@/types";

function progressToRecentCrawl(progress: CrawlProgress, website?: Website, hasPrevious = false): RecentCrawl {
  return {
    id: progress.id || `running-${progress.websiteId}`,
    websiteId: progress.websiteId,
    websiteName: website?.name ?? "Website",
    websiteUrl: website?.url ?? progress.startUrl,
    startUrl: progress.startUrl,
    status: progress.status,
    pagesDiscovered: progress.pagesDiscovered,
    pagesCrawled: progress.pagesCrawled,
    issuesFound: progress.issuesFound,
    progress: progress.progress,
    createdAt: new Date().toISOString(),
    hasPrevious,
  };
}

function mergeCrawl(crawls: RecentCrawl[], crawl: RecentCrawl) {
  return [crawl, ...crawls.filter((item) => item.id !== crawl.id && item.id !== `running-${crawl.websiteId}`)].slice(0, 10);
}

export function CrawlPageClient({
  websites,
  configured,
  selectedWebsiteId,
  initialRecentCrawls,
  initialOverview,
}: {
  websites: Website[];
  configured: boolean;
  selectedWebsiteId?: string;
  initialRecentCrawls: RecentCrawl[];
  initialOverview: CrawlOverview;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [recentCrawls, setRecentCrawls] = useState(initialRecentCrawls);
  const [crawlOverview, setCrawlOverview] = useState(initialOverview);
  const [runningCrawl, setRunningCrawl] = useState<RecentCrawl | null>(null);

  useEffect(() => {
    setRecentCrawls(initialRecentCrawls);
    setCrawlOverview(initialOverview);
    setRunningCrawl(null);
  }, [initialRecentCrawls, initialOverview]);

  const latestCrawl = crawlOverview.latestCompleted;
  const displayCrawls = useMemo(() => {
    if (!runningCrawl || runningCrawl.status === "completed" || runningCrawl.status === "failed") {
      return recentCrawls;
    }

    return mergeCrawl(recentCrawls, runningCrawl);
  }, [recentCrawls, runningCrawl]);

  const issuesHref = latestCrawl
    ? `/crawl/issues?websiteId=${encodeURIComponent(latestCrawl.websiteId)}&crawlId=${encodeURIComponent(latestCrawl.id)}`
    : selectedWebsiteId
      ? `/crawl/issues?websiteId=${encodeURIComponent(selectedWebsiteId)}`
      : "/crawl/issues";

  const handleProgress = useCallback((progress: CrawlProgress) => {
    if (progress.websiteId !== selectedWebsiteId) return;

    const website = websites.find((item) => item.id === progress.websiteId);
    const nextCrawl = progressToRecentCrawl(progress, website, recentCrawls.length > 0);

    if (progress.status === "completed") {
      setRunningCrawl(null);
      setRecentCrawls((current) => mergeCrawl(current, nextCrawl));
      setCrawlOverview((current) => ({
        latestCompleted: nextCrawl,
        completedCount: current.latestCompleted?.id === nextCrawl.id
          ? current.completedCount
          : current.completedCount + 1,
      }));
      router.refresh();
      return;
    }

    if (progress.status === "failed") {
      setRunningCrawl(null);
      setRecentCrawls((current) => mergeCrawl(current, nextCrawl));
      router.refresh();
      return;
    }

    setRunningCrawl(nextCrawl);
  }, [recentCrawls.length, router, selectedWebsiteId, websites]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("crawl.eyebrow")}
        title={t("crawl.title")}
        description={t("crawl.description")}
        actions={
          <Button asChild variant="outline" disabled={!latestCrawl}>
            <Link href={issuesHref}>
              <AlertTriangle className="size-4" />
              {t("crawl.viewIssues")}
            </Link>
          </Button>
        }
      />
      <CrawlRunner
        websites={websites}
        configured={configured}
        initialWebsiteId={selectedWebsiteId}
        issuesHref={issuesHref}
        onProgressChange={handleProgress}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5"><SearchCode className="size-5 text-primary" /><p className="mt-4 text-2xl font-bold">{latestCrawl?.pagesCrawled ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{t("crawl.pagesLast")}</p></Card>
        <Card className="p-5"><AlertTriangle className="size-5 text-warning" /><p className="mt-4 text-2xl font-bold">{latestCrawl?.issuesFound ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{t("crawl.issuesLast")}</p></Card>
        <Card className="p-5"><CalendarDays className="size-5 text-success" /><p className="mt-4 text-lg font-bold">{latestCrawl ? formatDate(latestCrawl.createdAt) : "N/A"}</p><p className="mt-1 text-xs text-muted-foreground">{t("crawl.latestDate")}</p></Card>
        <Card className="p-5"><CheckCircle2 className="size-5 text-success" /><p className="mt-4 text-2xl font-bold">{crawlOverview.completedCount}</p><p className="mt-1 text-xs text-muted-foreground">{t("crawl.completedTotal")}</p></Card>
      </div>
      <SectionCard title={t("crawl.recent")} description={t("crawl.recentDescription")}>
        {displayCrawls.length ? (
          <div className="space-y-3">
            {displayCrawls.map((crawl) => (
              <div key={crawl.id} className="rounded-xl border bg-secondary/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{crawl.websiteName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {crawl.pagesCrawled} {t("crawl.of")} {crawl.pagesDiscovered} {t("crawl.pages")} · {crawl.issuesFound} {t("crawl.issues")} · {formatDate(crawl.createdAt)}
                    </p>
                  </div>
                  <Badge variant={crawl.status === "completed" ? "success" : crawl.status === "failed" ? "destructive" : "default"}>
                    {crawl.status === "completed" ? t("crawl.statusCompleted") : crawl.status === "failed" ? t("crawl.statusFailed") : crawl.status === "running" ? t("crawl.statusRunning") : t("crawl.statusPending")}
                  </Badge>
                  {crawl.id.startsWith("running-") ? null : <CrawlRowActions crawl={crawl} />}
                </div>
                <Progress
                  value={crawl.progress}
                  indicatorClassName={crawl.status === "completed" ? "bg-success" : crawl.status === "failed" ? "bg-destructive" : "bg-primary"}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={SearchCode}
            title={t("crawl.noCrawls")}
            description={configured ? t("crawl.noCrawlsConfigured") : t("crawl.noCrawlsSupabase")}
          />
        )}
      </SectionCard>
    </div>
  );
}
