import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  FileWarning,
  Globe2,
  Inbox,
  Layers3,
  ScanSearch,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { ActivityFeed } from "@/components/activity-feed";
import { DashboardCard } from "@/components/dashboard-card";
import { IndexedPagesChart, SeoEvolutionChart, TrafficChart } from "@/components/dashboard-charts";
import { EmptyState } from "@/components/empty-state";
import { SeoScoreCard } from "@/components/seo-score-card";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { getServerTranslator } from "@/lib/i18n/server";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { getDashboardData } from "@/lib/supabase/dashboard";
import { getWebsiteById, getWebsites } from "@/lib/supabase/websites";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ websiteId?: string }>;
}) {
  const params = await searchParams;
  const { locale, t } = await getServerTranslator();
  const workspace = await getCurrentWorkspace();
  const { websites } = await getWebsites(workspace?.organization.id);
  const selectedWebsite =
    (params?.websiteId ? await getWebsiteById(params.websiteId, workspace?.organization.id) : null) ?? websites[0] ?? null;
  const dashboardData = selectedWebsite
    ? await getDashboardData(selectedWebsite.id)
    : null;
  const currentDate = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const seoScore = dashboardData?.latestSeoScore ?? selectedWebsite?.score ?? null;
  const searchConsole = dashboardData?.searchConsole;
  const hasSearchConsoleData =
    Boolean(searchConsole) && dashboardData?.searchConsoleUnavailableReason === null;
  const indexedPagesData = searchConsole?.topPages.map((_, index) => index + 1) ?? [];
  const trafficData = searchConsole?.topPages.map((page) => page.clicks).filter((value) => value > 0) ?? [];
  const activityItems =
    dashboardData?.activities.map((activity) => ({
      id: activity.id,
      title: activity.action,
      detail: activity.description ?? t("dashboard.savedActivity"),
      time: formatDate(activity.createdAt),
      tone: activity.tone,
    })) ?? [];
  const recommendationText = searchConsole?.opportunities[0]
    ? `${searchConsole.opportunities[0].key} has relevant impressions and can be optimized for CTR.`
    : selectedWebsite
      ? `${t("dashboard.dataUnavailable")} Search Console: ${selectedWebsite.name}.`
      : t("dashboard.noActiveWebsite");
  const websiteQuery = selectedWebsite ? `?websiteId=${encodeURIComponent(selectedWebsite.id)}` : "";

  if (websites.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeader
          eyebrow={currentDate}
          title={t("dashboard.welcomeTitle")}
          description={t("dashboard.welcomeDescription")}
          actions={
            <Button asChild>
              <Link href="/websites/new"><Globe2 className="size-4" />{t("dashboard.addWebsite")}</Link>
            </Button>
          }
        />
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["1", t("dashboard.stepAddWebsite")],
              ["2", t("dashboard.stepRunCrawl")],
              ["3", t("dashboard.stepViewAudit")],
              ["4", t("dashboard.stepAskCopilot")],
            ].map(([step, label]) => (
              <div key={step} className="rounded-xl border bg-secondary/20 p-4">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">{step}</span>
                <p className="mt-4 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={currentDate}
        title={selectedWebsite ? `Dashboard ${selectedWebsite.name}` : "Dashboard"}
        description={selectedWebsite ? `${t("dashboard.filteredData")} ${selectedWebsite.url.replace(/^https?:\/\//, "")}.` : t("dashboard.noWebsiteDescription")}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/reports${websiteQuery}`}>{t("dashboard.viewReport")}</Link>
            </Button>
            <Button asChild>
              <Link href={`/audit${websiteQuery}`}><ScanSearch className="size-4" />{t("dashboard.runAudit")}</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title={t("dashboard.activeWebsite")} value={selectedWebsite ? "1" : "0"} change={Number.NaN} changeLabel={selectedWebsite?.name ?? t("dashboard.noWebsite")} icon={Globe2} />
        <DashboardCard title={t("dashboard.seoScore")} value={seoScore !== null ? String(seoScore) : t("dashboard.unavailable")} change={Number.NaN} changeLabel={dashboardData?.latestAuditStatus ? `audit ${dashboardData.latestAuditStatus}` : t("dashboard.noRealAudit")} icon={TrendingUp} tone={seoScore && seoScore >= 75 ? "success" : "warning"} />
        <DashboardCard title={t("dashboard.analyzedPages")} value={dashboardData ? formatNumber(dashboardData.analyzedPages) : "0"} change={Number.NaN} changeLabel={t("dashboard.lastRealCrawl")} icon={Layers3} tone="primary" />
        <DashboardCard title={t("dashboard.detectedIssues")} value={dashboardData ? formatNumber(dashboardData.detectedIssues) : "0"} change={Number.NaN} changeLabel={t("dashboard.unresolvedIssues")} icon={FileWarning} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <SectionCard
          title={t("dashboard.seoEvolution")}
          description={selectedWebsite ? `${t("dashboard.auditScores")} ${selectedWebsite.name}` : t("dashboard.auditScores")}
          action={
            <div className="flex items-center gap-2">
              <Badge variant={dashboardData?.seoScores.length ? "success" : "outline"}>
                {dashboardData?.seoScores.length ? t("dashboard.realData") : t("dashboard.dataUnavailable")}
              </Badge>
            </div>
          }
        >
          {dashboardData?.seoScores.length ? (
            <>
              <div className="mb-4 flex items-end gap-2">
                <span className="font-[var(--font-manrope)] text-3xl font-bold">{seoScore ?? dashboardData.seoScores.at(-1)}</span>
                <span className="pb-1 text-xs text-muted-foreground">{t("dashboard.latestScore")}</span>
              </div>
              <SeoEvolutionChart data={dashboardData.seoScores} />
            </>
          ) : (
            <EmptyState
              icon={BarChart3}
              title={t("dashboard.seoDataUnavailable")}
              description={t("dashboard.runAuditForEvolution")}
              action={t("dashboard.runAudit")}
              actionHref={`/audit${websiteQuery}`}
            />
          )}
        </SectionCard>

        <SectionCard title={t("dashboard.websiteScores")} description={t("dashboard.currentPerformance")}>
          <div className="grid grid-cols-2 gap-4 py-2">
            {selectedWebsite ? (
              <div className="flex flex-col items-center rounded-xl border bg-secondary/20 p-4 text-center">
                <SeoScoreCard score={seoScore ?? selectedWebsite.score} />
                <p className="mt-3 text-sm font-semibold">{selectedWebsite.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboardData?.analyzedPages ? `${dashboardData.analyzedPages} ${t("dashboard.analyzedPages").toLowerCase()}` : t("dashboard.noRealCrawl")}
                </p>
              </div>
            ) : null}
          </div>
          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link href="/websites">{t("dashboard.allWebsites")} <ArrowRight className="size-4" /></Link>
          </Button>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard title={t("dashboard.indexedPages")} description={t("dashboard.googlePages")}>
          {hasSearchConsoleData ? (
            <>
              <div className="mb-1 flex items-end justify-between">
                <div>
                  <span className="font-[var(--font-manrope)] text-2xl font-bold">{searchConsole?.topPages.length ?? 0}</span>
                  <span className="ml-2 text-xs font-medium text-muted-foreground">{t("dashboard.pagesWithImpressions")}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2 rounded-full bg-success" /> Search Console
                </div>
              </div>
              <IndexedPagesChart data={indexedPagesData} />
            </>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title={dashboardData?.searchConsoleUnavailableReason === "not_connected" ? t("dashboard.connectSearchConsole") : t("dashboard.dataUnavailable")}
              description={t("dashboard.indexedPagesDescription")}
              action={t("dashboard.connect")}
              actionHref={selectedWebsite ? `/websites/${selectedWebsite.id}/search-console` : undefined}
            />
          )}
        </SectionCard>

        <SectionCard title={t("dashboard.estimatedTraffic")} description={t("dashboard.organicClicks")}>
          {hasSearchConsoleData ? (
            <>
              <div className="mb-1 flex items-end justify-between">
                <span className="font-[var(--font-manrope)] text-2xl font-bold">
                  {formatNumber(searchConsole?.metrics.clicks ?? 0)}
                </span>
                <Badge variant="outline">{t("dashboard.realData")}</Badge>
              </div>
              {trafficData.length ? <TrafficChart data={trafficData} /> : (
                <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  {t("dashboard.noPageClicks")}
                </div>
              )}
              <div className="mt-2 text-[10px] text-muted-foreground">
                {t("dashboard.period")}: {searchConsole ? `${searchConsole.period.startDate} - ${searchConsole.period.endDate}` : ""}
              </div>
            </>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title={dashboardData?.searchConsoleUnavailableReason === "not_connected" ? t("dashboard.connectSearchConsole") : t("dashboard.dataUnavailable")}
              description={t("dashboard.trafficDescription")}
              action={t("dashboard.connectSearchConsole")}
              actionHref={selectedWebsite ? `/websites/${selectedWebsite.id}/search-console` : undefined}
            />
          )}
        </SectionCard>

        <SectionCard
          title={t("dashboard.recentActivity")}
          description={t("dashboard.latestUpdates")}
          action={<Button variant="ghost" size="sm" asChild><Link href={`/reports${websiteQuery}`}>{t("dashboard.viewAll")}</Link></Button>}
          className="lg:col-span-2 xl:col-span-1"
        >
          {activityItems.length ? (
            <ActivityFeed activities={activityItems} limit={4} />
          ) : (
            <EmptyState
              icon={Inbox}
              title={t("dashboard.noRecentActivity")}
              description={t("dashboard.noRealActivityLogs")}
            />
          )}
        </SectionCard>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold">{t("dashboard.seoOpportunity")}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {recommendationText}
              </p>
            </div>
          </div>
          <Button className="shrink-0" asChild>
            <Link href={selectedWebsite ? `/recommendations?websiteId=${selectedWebsite.id}` : "/recommendations"}>{t("dashboard.viewRecommendations")} <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
