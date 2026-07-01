"use client";

import { AlertCircle, CheckCircle2, Loader2, Play, SearchCode } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useActiveWebsite } from "@/components/active-website-provider";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { CrawlProgress, Website } from "@/types";

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

export function CrawlRunner({
  websites,
  configured,
  initialWebsiteId,
  issuesHref,
  onProgressChange,
}: {
  websites: Website[];
  configured: boolean;
  initialWebsiteId?: string;
  issuesHref?: string;
  onProgressChange?: (progress: CrawlProgress) => void;
}) {
  const { t } = useI18n();
  const { activeWebsiteId, setActiveWebsiteId } = useActiveWebsite();
  const initialWebsite = websites.find((website) => website.id === initialWebsiteId) ?? websites[0];
  const [websiteId, setWebsiteId] = useState(initialWebsite?.id ?? activeWebsiteId ?? "");
  const [url, setUrl] = useState(initialWebsite?.url ?? "");
  const [crawlId, setCrawlId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [error, setError] = useState("");
  const isRunning = progress?.status === "pending" || progress?.status === "running";

  const publishProgress = useCallback((nextProgress: CrawlProgress | null) => {
    setProgress(nextProgress);
    if (nextProgress) onProgressChange?.(nextProgress);
  }, [onProgressChange]);

  useEffect(() => {
    const nextWebsite = websites.find((website) => website.id === activeWebsiteId);
    if (!nextWebsite || nextWebsite.id === websiteId || isRunning) return;

    setWebsiteId(nextWebsite.id);
    setUrl(nextWebsite.url);
  }, [activeWebsiteId, websites, websiteId, isRunning]);

  useEffect(() => {
    if (!crawlId) return;
    let active = true;

    const poll = async () => {
      try {
        const response = await fetch(`/api/crawl?id=${encodeURIComponent(crawlId)}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as { data?: CrawlProgress; error?: string };
        if (!response.ok || !result.data) throw new Error(result.error ?? t("crawl.progressUnavailable"));
        if (!active) return;
        publishProgress(result.data);
        if (result.data.status === "completed") {
          setCrawlId(null);
        } else if (result.data.status === "failed") {
          setError(result.data.errorMessage ?? t("crawl.failed"));
          setCrawlId(null);
        }
      } catch (pollError) {
        if (active) setError(pollError instanceof Error ? pollError.message : t("crawl.progressError"));
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [crawlId, publishProgress, t]);

  function handleWebsiteChange(id: string) {
    setWebsiteId(id);
    setActiveWebsiteId(id);
    const website = websites.find((item) => item.id === id);
    if (website) setUrl(website.url);
  }

  async function startCrawl() {
    setError("");
    const pendingProgress: CrawlProgress = {
      id: "",
      websiteId,
      status: "pending",
      startUrl: url,
      pagesDiscovered: 1,
      pagesCrawled: 0,
      issuesFound: 0,
      progress: 0,
      errorMessage: null,
    };
    publishProgress(pendingProgress);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, url }),
      });
      const result = (await response.json()) as {
        data?: { crawlId: string };
        error?: string;
      };
      if (!response.ok || !result.data) throw new Error(result.error ?? t("crawl.notStarted"));
      publishProgress({
        ...pendingProgress,
        id: result.data.crawlId,
      });
      setCrawlId(result.data.crawlId);
    } catch (startError) {
      publishProgress(null);
      setError(startError instanceof Error ? startError.message : t("crawl.notStarted"));
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.5fr_auto] lg:items-end">
          <div>
            <label htmlFor="crawl-website" className="mb-2 block text-sm font-medium">
              Website
            </label>
            <select
              id="crawl-website"
              className={selectClassName}
              value={websiteId}
              onChange={(event) => handleWebsiteChange(event.target.value)}
              disabled={isRunning}
            >
              {websites.map((website) => (
                <option key={website.id} value={website.id}>{website.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crawl-url" className="mb-2 block text-sm font-medium">
              {t("crawl.startUrl")}
            </label>
            <Input
              id="crawl-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={t("crawl.urlPlaceholder")}
              disabled={isRunning}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <Button
              onClick={startCrawl}
              disabled={!configured || !websiteId || !url || isRunning}
            >
              {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {isRunning ? t("crawl.scanning") : t("crawl.scanWebsite")}
            </Button>
            <Button variant="outline" asChild>
              <Link href={issuesHref ?? `/crawl/issues?websiteId=${encodeURIComponent(websiteId)}`}>
                <AlertCircle className="size-4" />
                {t("crawl.viewIssues")}
              </Link>
            </Button>
          </div>
        </div>

        {!configured && (
          <p className="mt-4 flex items-center gap-2 text-xs text-warning">
            <AlertCircle className="size-4" />
            {t("crawl.supabaseRequired")}
          </p>
        )}
        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />{error}
          </p>
        )}
      </Card>

      {progress && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {progress.status === "completed" ? <CheckCircle2 className="size-5" /> : <SearchCode className="size-5" />}
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {progress.status === "completed" ? t("crawl.scanCompleted") : t("crawl.scanRunning")}
                </p>
                <p className="mt-0.5 max-w-lg truncate text-xs text-muted-foreground">{progress.startUrl}</p>
              </div>
            </div>
            <Badge variant={progress.status === "completed" ? "success" : progress.status === "failed" ? "destructive" : "default"}>
              {progress.status === "completed" ? t("crawl.statusCompleted") : progress.status === "failed" ? t("crawl.statusFailed") : `${progress.progress}%`}
            </Badge>
          </div>
          <Progress value={progress.progress} indicatorClassName={progress.status === "failed" ? "bg-destructive" : progress.status === "completed" ? "bg-success" : "bg-primary"} />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary/50 p-3"><p className="text-xl font-bold">{progress.pagesDiscovered}</p><p className="mt-1 text-[10px] text-muted-foreground">{t("crawl.pagesFound")}</p></div>
            <div className="rounded-lg bg-secondary/50 p-3"><p className="text-xl font-bold">{progress.pagesCrawled}</p><p className="mt-1 text-[10px] text-muted-foreground">{t("crawl.pagesAnalyzed")}</p></div>
            <div className="rounded-lg bg-secondary/50 p-3"><p className="text-xl font-bold">{progress.issuesFound}</p><p className="mt-1 text-[10px] text-muted-foreground">{t("crawl.seoIssues")}</p></div>
          </div>
        </Card>
      )}
    </div>
  );
}
