import { AlertTriangle, ArrowLeft, BarChart3, Bot, ExternalLink, FileSearch, FileText, LayoutDashboard, SearchCode } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiRecommendationsPanel } from "@/components/ai-recommendations-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SeoScoreCard } from "@/components/seo-score-card";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isOpenAiConfigured } from "@/lib/openai";
import { getServerTranslator } from "@/lib/i18n/server";
import { cn, formatDate } from "@/lib/utils";
import { getWebsiteAiRecommendations } from "@/lib/supabase/ai-recommendations";
import { getWebsiteCrawlData } from "@/lib/supabase/crawl-data";
import { getWebsiteById } from "@/lib/supabase/websites";

const tabs = [
  { id: "summary", labelKey: "website.summary", icon: LayoutDashboard },
  { id: "pages", labelKey: "website.pages", icon: FileText },
  { id: "audit", labelKey: "nav.audit", icon: FileSearch },
  { id: "issues", labelKey: "website.issues", icon: AlertTriangle },
  { id: "ai", labelKey: "nav.recommendations", icon: Bot },
] as const;

export default async function WebsiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { t } = await getServerTranslator();
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "summary";
  const website = await getWebsiteById(id);
  if (!website) notFound();
  const [crawlData, aiRecommendations] = await Promise.all([
    getWebsiteCrawlData(id),
    getWebsiteAiRecommendations(id),
  ]);

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild><Link href="/websites"><ArrowLeft className="size-4" />{t("website.backAll")}</Link></Button>
      <PageHeader
        eyebrow={website.url.replace("https://", "")}
        title={website.name}
        description={`${website.pages} ${t("website.monitoredSummary")} ${website.keywords}.`}
        actions={<><Button variant="outline" asChild><Link href={`/websites/${website.id}/search-console`}><BarChart3 className="size-4" />Search Console</Link></Button><Button variant="outline" asChild><a href={website.url} target="_blank" rel="noreferrer">{t("website.openSite")} <ExternalLink className="size-4" /></a></Button><Button asChild><Link href={`/crawl?websiteId=${website.id}`}><SearchCode className="size-4" />{t("website.startCrawl")}</Link></Button></>}
      />

      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/websites/${website.id}?tab=${item.id}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
              activeTab === item.id && "bg-primary/10 text-primary",
            )}
          >
            <item.icon className="size-4" />{t(item.labelKey)}
            {item.id === "issues" && crawlData.issues.length > 0 && (
              <Badge variant="warning" className="ml-1 px-1.5 py-0">{crawlData.issues.length}</Badge>
            )}
          </Link>
        ))}
      </div>

      {activeTab === "summary" && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SectionCard title={t("dashboard.seoScore")} description={t("website.updatedLastAudit")}><div className="flex justify-center py-4"><SeoScoreCard score={crawlData.audit?.score ?? website.score} size="lg" /></div></SectionCard>
            <SectionCard title={t("website.coverage")} description={t("website.discoveredPages")}><p className="mt-4 text-4xl font-bold">{crawlData.pages.length || website.pages}</p><p className="mt-2 text-sm text-muted-foreground">{t("website.fullyAnalyzedPages")}</p></SectionCard>
            <SectionCard title={t("dashboard.detectedIssues")} description={t("website.latestAudit")}><p className="mt-4 text-4xl font-bold">{crawlData.issues.length}</p><Badge variant={crawlData.issues.length ? "warning" : "success"} className="mt-3">{crawlData.issues.length ? t("website.needsAttention") : t("website.noIssues")}</Badge></SectionCard>
          </div>
          <div className="rounded-xl border bg-card p-6"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold">{t("website.technicalCrawl")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("website.technicalCrawlDescription")}</p></div><Button variant="outline" asChild><Link href={`/crawl?websiteId=${website.id}`}><SearchCode className="size-4" />{t("website.startCrawl")}</Link></Button></div></div>
        </>
      )}

      {activeTab === "pages" && (
        crawlData.pages.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="border-b bg-secondary/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3.5">{t("website.page")}</th><th className="px-5 py-3.5">{t("website.status")}</th><th className="px-5 py-3.5">{t("website.score")}</th><th className="px-5 py-3.5">{t("website.words")}</th><th className="px-5 py-3.5">{t("website.issues")}</th><th className="px-5 py-3.5">{t("website.lastCrawl")}</th></tr></thead>
                <tbody className="divide-y">
                  {crawlData.pages.map((page) => <tr key={page.id} className="hover:bg-secondary/30"><td className="max-w-md px-5 py-4"><p className="truncate text-sm font-medium">{page.title ?? t("website.noTitle")}</p><p className="mt-1 truncate text-xs text-muted-foreground">{page.url}</p></td><td className="px-5 py-4"><Badge variant={page.statusCode && page.statusCode < 400 ? "success" : "destructive"}>{page.statusCode ?? "—"}</Badge></td><td className="px-5 py-4 text-sm font-semibold">{page.seoScore}/100</td><td className="px-5 py-4 text-sm">{page.wordCount}</td><td className="px-5 py-4"><Badge variant={page.issuesCount ? "warning" : "success"}>{page.issuesCount}</Badge></td><td className="px-5 py-4 text-xs text-muted-foreground">{page.crawledAt ? formatDate(page.crawledAt) : "—"}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        ) : <EmptyState icon={FileText} title={t("website.noAnalyzedPages")} description={t("website.noAnalyzedPagesDescription")} action={t("website.startCrawl")} actionHref={`/crawl?websiteId=${website.id}`} />
      )}

      {activeTab === "audit" && (
        crawlData.audit ? (
          <div className="grid gap-4 md:grid-cols-[0.8fr_1.5fr]">
            <SectionCard title={t("website.auditScore")} description={crawlData.audit.completedAt ? `${t("website.completed")} ${formatDate(crawlData.audit.completedAt)}` : t("website.inProgress")}><div className="flex justify-center py-5"><SeoScoreCard score={crawlData.audit.score} size="lg" /></div></SectionCard>
            <SectionCard title={t("website.results")} description={t("website.latestScanSummary")}><div className="grid gap-4 py-4 sm:grid-cols-2"><div className="rounded-xl bg-secondary/40 p-5"><p className="text-3xl font-bold">{crawlData.audit.summary.pages ?? crawlData.pages.length}</p><p className="mt-1 text-xs text-muted-foreground">{t("dashboard.analyzedPages")}</p></div><div className="rounded-xl bg-secondary/40 p-5"><p className="text-3xl font-bold">{crawlData.audit.summary.issues ?? crawlData.issues.length}</p><p className="mt-1 text-xs text-muted-foreground">{t("website.detectedProblems")}</p></div></div></SectionCard>
          </div>
        ) : <EmptyState icon={FileSearch} title={t("website.noAudit")} description={t("website.noAuditDescription")} action={t("website.startCrawl")} actionHref={`/crawl?websiteId=${website.id}`} />
      )}

      {activeTab === "issues" && (
        crawlData.issues.length ? (
          <div className="space-y-3">
            {crawlData.issues.map((issue) => <div key={issue.id} className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-start"><span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", issue.severity === "critical" ? "bg-destructive/10 text-destructive" : issue.severity === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}><AlertTriangle className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{issue.title}</h3><Badge variant={issue.severity === "critical" ? "destructive" : issue.severity === "warning" ? "warning" : "default"}>{issue.severity === "critical" ? t("website.critical") : issue.severity === "warning" ? t("website.warning") : t("website.notice")}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{issue.description}</p>{issue.pageUrl && <p className="mt-2 truncate text-xs text-primary">{issue.pageUrl}</p>}{issue.recommendation && <p className="mt-3 text-xs"><span className="font-semibold">{t("website.recommendation")}:</span> {issue.recommendation}</p>}</div></div>)}
          </div>
        ) : <EmptyState icon={AlertTriangle} title={t("website.noSeoIssues")} description={t("website.noSeoIssuesDescription")} action={t("website.startCrawl")} actionHref={`/crawl?websiteId=${website.id}`} />
      )}

      {activeTab === "ai" && (
        <AiRecommendationsPanel
          pages={crawlData.pages}
          initialRecommendations={aiRecommendations}
          configured={isOpenAiConfigured()}
        />
      )}
    </div>
  );
}
