"use client";

import { AlertTriangle, CheckCircle2, FileSearch, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AuditIssuesPanel } from "@/components/audit-issues-panel";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { SeoScoreCard } from "@/components/seo-score-card";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AuditSummaryData } from "@/lib/supabase/audit-data";

export function AuditPageClient({ data, websiteId }: { data: AuditSummaryData; websiteId?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeIssues = useMemo(
    () => data.issues.filter((issue) => issue.status !== "resolved"),
    [data.issues],
  );
  const criticalIssues = activeIssues
    .filter((issue) => issue.severity === "Critical" || issue.severity === "Critică")
    .reduce((total, issue) => total + issue.count, 0);
  const warningIssues = activeIssues
    .filter((issue) => issue.severity !== "Critical" && issue.severity !== "Critică")
    .reduce((total, issue) => total + issue.count, 0);
  const resolvedChecks = data.issues
    .filter((issue) => issue.status === "resolved")
    .reduce((total, issue) => total + issue.count, 0);
  const passedChecks = Number(data.audit?.summary.passedChecks ?? 0) + resolvedChecks;
  const score = data.audit?.score ?? data.website?.score ?? 0;
  const resolvedWebsiteId = websiteId ?? data.website?.id;

  async function runAudit() {
    if (!resolvedWebsiteId) {
      setError(t("audit.noWebsite"));
      return;
    }

    setIsRunning(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: resolvedWebsiteId }),
      });
      const payload = (await response.json()) as {
        data?: { seoScore: number; criticalIssues: number; warnings: number };
        error?: string;
        code?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? t("audit.failed"));
      }

      setMessage(
        `${t("audit.completed")}: score ${payload.data.seoScore}/100, ${payload.data.criticalIssues} ${t("audit.critical")}, ${payload.data.warnings} ${t("audit.warnings")}.`,
      );
      router.refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : t("audit.failed"));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("audit.eyebrow")}
        title={t("nav.audit")}
        description={
          data.website
            ? `${t("audit.descriptionWebsite")} ${data.website.name}. ${t("audit.descriptionSuffix")}`
            : t("audit.descriptionGeneric")
        }
        actions={
          <Button onClick={runAudit} disabled={isRunning || !resolvedWebsiteId || !data.configured}>
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
            {isRunning ? t("audit.running") : t("audit.runNew")}
          </Button>
        }
      />

      {!data.configured ? (
        <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {t("audit.supabaseRequired")}
        </Card>
      ) : null}

      {data.configured && !data.latestCompletedCrawl ? (
        <Card className="flex flex-col gap-3 border-warning/30 bg-warning/10 p-4 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <span>{t("audit.noCompletedCrawl")}</span>
          {resolvedWebsiteId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/crawl?websiteId=${encodeURIComponent(resolvedWebsiteId)}`}>
                {t("audit.openCrawl")}
              </Link>
            </Button>
          ) : null}
        </Card>
      ) : null}

      {message ? (
        <Card className="border-success/30 bg-success/10 p-4 text-sm text-success">
          {message}
        </Card>
      ) : null}
      {error ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          {error.includes("No completed crawl") && resolvedWebsiteId ? (
            <Button asChild variant="outline" size="sm" className="ml-3">
              <Link href={`/crawl?websiteId=${encodeURIComponent(resolvedWebsiteId)}`}>
                {t("audit.runCrawl")}
              </Link>
            </Button>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><ShieldAlert className="size-5" /></span><div><p className="text-2xl font-bold">{criticalIssues}</p><p className="text-xs text-muted-foreground">{t("audit.criticalIssues")}</p></div></Card>
        <Card className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning"><AlertTriangle className="size-5" /></span><div><p className="text-2xl font-bold">{warningIssues}</p><p className="text-xs text-muted-foreground">{t("audit.warningIssues")}</p></div></Card>
        <Card className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success"><CheckCircle2 className="size-5" /></span><div><p className="text-2xl font-bold">{passedChecks}</p><p className="text-xs text-muted-foreground">{t("audit.passedChecks")}</p></div></Card>
        <Card className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSearch className="size-5" /></span><div><p className="text-2xl font-bold">{score}/100</p><p className="text-xs text-muted-foreground">{t("audit.overallHealth")}</p></div></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <SectionCard title={t("audit.overallHealth")} description={data.website ? data.website.name : "Website"}>
          <div className="flex flex-col items-center py-5">
            <SeoScoreCard score={score} size="lg" />
            <Badge variant={score >= 75 ? "success" : score >= 60 ? "warning" : "destructive"} className="mt-4">
              {score >= 75 ? t("audit.good") : score >= 60 ? t("audit.needsAttention") : t("audit.highRisk")}
            </Badge>
          </div>
        </SectionCard>
        <SectionCard title={t("audit.priorityIssues")} description={t("audit.priorityDescription")}>
          <AuditIssuesPanel issues={data.issues} />
        </SectionCard>
      </div>
    </div>
  );
}
