import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileWarning,
  Globe2,
  Layers3,
  ShieldAlert,
} from "lucide-react";
import { CrawlIssuesCenter } from "@/components/crawl-issues-center";
import { PageHeader } from "@/components/page-header";
import { SeoScoreCard } from "@/components/seo-score-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getServerTranslator } from "@/lib/i18n/server";
import { getCrawlIssuesCenterData } from "@/lib/supabase/crawl-data";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Crawl Issues" };
export const dynamic = "force-dynamic";

function formatDuration(seconds: number | null | undefined, unavailable: string) {
  if (seconds === null || seconds === undefined) return unavailable;
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default async function CrawlIssuesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    websiteId?: string;
    crawlId?: string;
    page?: string;
    severity?: string;
    category?: string;
    status?: string;
    search?: string;
    compare?: string;
  }>;
}) {
  const params = await searchParams;
  const { t } = await getServerTranslator();
  const page = Math.max(1, Number(params?.page ?? 1) || 1);
  const data = await getCrawlIssuesCenterData({
    websiteId: params?.websiteId,
    crawlId: params?.crawlId,
    page,
    severity: params?.severity,
    category: params?.category,
    status: params?.status,
    search: params?.search,
  });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Crawl Issues Center"
        title={t("crawl.issuesTitle")}
        description={t("crawl.issuesDescription")}
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe2 className="size-4" />
                Website
              </p>
              <p className="mt-2 text-sm font-semibold">{data.website?.name ?? "N/A"}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{data.website?.url ?? "N/A"}</p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-4" />
                {t("crawl.crawlDate")}
              </p>
              <p className="mt-2 text-sm font-semibold">
                {data.crawl?.completedAt
                  ? formatDate(data.crawl.completedAt)
                  : data.crawl?.startedAt
                    ? formatDate(data.crawl.startedAt)
                    : "N/A"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("crawl.duration")}: {formatDuration(data.crawl?.durationSeconds, t("crawl.unavailable"))}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Layers3 className="size-4" />
                Crawl
              </p>
              <p className="mt-2 text-sm font-semibold">
                {formatNumber(data.crawl?.pagesCrawled ?? 0)} {t("crawl.pages")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatNumber(data.crawl?.issuesFound ?? 0)} {t("crawl.detected")}
              </p>
            </div>
          </div>
        </Card>

        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs text-muted-foreground">SEO Score</p>
            <p className="mt-2 text-sm font-semibold">
              {data.audit ? `${data.audit.score}/100` : t("dashboard.unavailable")}
            </p>
          </div>
          <SeoScoreCard score={data.audit?.score ?? 0} />
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="p-5">
          <FileWarning className="size-5 text-primary" />
          <p className="mt-4 text-2xl font-bold">{data.stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("crawl.totalIssues")}</p>
        </Card>
        <Card className="p-5">
          <ShieldAlert className="size-5 text-destructive" />
          <p className="mt-4 text-2xl font-bold">{data.stats.critical}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("crawl.critical")}</p>
        </Card>
        <Card className="p-5">
          <AlertTriangle className="size-5 text-destructive" />
          <p className="mt-4 text-2xl font-bold">{data.stats.high}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("crawl.high")}</p>
        </Card>
        <Card className="p-5">
          <AlertTriangle className="size-5 text-warning" />
          <p className="mt-4 text-2xl font-bold">{data.stats.medium}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("crawl.medium")}</p>
        </Card>
        <Card className="p-5">
          <BarChart3 className="size-5 text-muted-foreground" />
          <p className="mt-4 text-2xl font-bold">{data.stats.low}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("crawl.low")}</p>
        </Card>
        <Card className="p-5">
          <CheckCircle2 className="size-5 text-success" />
          <p className="mt-4 text-2xl font-bold">{data.stats.resolved}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("crawl.resolved")}</p>
        </Card>
      </div>

      {data.comparison.previousCrawlId ? (
        <Badge variant="outline">{t("crawl.previousAvailable")}</Badge>
      ) : (
        <Badge variant="outline">{t("crawl.previousUnavailable")}</Badge>
      )}

      <CrawlIssuesCenter data={data} initialShowComparison={params?.compare === "previous"} />
    </div>
  );
}
