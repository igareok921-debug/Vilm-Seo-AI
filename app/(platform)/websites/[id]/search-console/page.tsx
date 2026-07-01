import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  BarChart3,
  ExternalLink,
  Eye,
  Link2,
  MousePointerClick,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isGoogleSearchConsoleConfigured } from "@/lib/google/config";
import { getSearchConsoleDashboard } from "@/lib/google/search-console";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/utils";
import { getWebsiteById } from "@/lib/supabase/websites";

export const dynamic = "force-dynamic";
export const metadata = { title: "Google Search Console" };

export default async function SearchConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ google?: string }>;
}) {
  const { id } = await params;
  const { google: googleStatus } = await searchParams;
  const { t } = await getServerTranslator();
  const website = await getWebsiteById(id);
  if (!website) notFound();

  const data = await getSearchConsoleDashboard(id);
  const configured = isGoogleSearchConsoleConfigured();

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/websites/${website.id}`}>
          <ArrowLeft className="size-4" />{t("searchConsole.backTo")} {website.name}
        </Link>
      </Button>

      <PageHeader
        eyebrow={t("searchConsole.eyebrow")}
        title="Google Search Console"
        description={`${t("searchConsole.descriptionPrefix")} ${website.url.replace("https://", "")}.`}
        actions={
          data.connected ? (
            <Button variant="outline" asChild>
              <Link href={`/api/search-console/connect?websiteId=${website.id}`}>
                {t("searchConsole.reconnect")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {googleStatus === "connected" && (
        <div className="flex gap-3 rounded-xl border border-success/25 bg-success/10 p-4 text-sm text-success">
          <Link2 className="size-4 shrink-0" />
          {t("searchConsole.connectedSuccess")}
        </div>
      )}
      {googleStatus && googleStatus !== "connected" && (
        <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
          <AlertCircle className="size-4 shrink-0" />
          {t("searchConsole.connectFailed")} {googleStatus.replaceAll("_", " ")}.
        </div>
      )}

      {!data.connected && (
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/15 via-card to-card p-6 sm:p-8">
          <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex max-w-2xl gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-bold text-blue-600">
                G
              </span>
              <div>
                <h3 className="text-lg font-semibold">{t("searchConsole.connectTitle")}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("searchConsole.connectDescription")}
                </p>
                {!configured && (
                  <p className="mt-3 text-xs text-warning">
                    {t("searchConsole.envMissing")}
                  </p>
                )}
              </div>
            </div>
            <Button size="lg" asChild={configured} disabled={!configured}>
              {configured ? (
                <Link href={`/api/search-console/connect?websiteId=${website.id}`}>
                  <Link2 className="size-4" />{t("searchConsole.connectButton")}
                </Link>
              ) : (
                <>
                  <Link2 className="size-4" />{t("searchConsole.connectButton")}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {data.error && (
        <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
          <AlertCircle className="size-4 shrink-0" />{data.error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={data.source === "google" ? "success" : "outline"}>
          {data.source === "google" ? t("searchConsole.realGoogleData") : t("searchConsole.dataUnavailable")}
        </Badge>
        {data.property && <span>{t("searchConsole.property")}: {data.property}</span>}
        <span>{data.period.startDate} – {data.period.endDate}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("searchConsole.clicks"), value: formatNumber(data.metrics.clicks), icon: MousePointerClick, tone: "text-primary bg-primary/10" },
          { label: t("searchConsole.impressions"), value: formatNumber(data.metrics.impressions), icon: Eye, tone: "text-success bg-success/10" },
          { label: t("searchConsole.avgCtr"), value: `${data.metrics.ctr.toFixed(2)}%`, icon: Target, tone: "text-warning bg-warning/10" },
          { label: t("searchConsole.avgPosition"), value: data.metrics.position.toFixed(1), icon: BarChart3, tone: "text-primary bg-primary/10" },
        ].map((metric) => (
          <Card key={metric.label} className="p-5">
            <span className={`flex size-10 items-center justify-center rounded-xl ${metric.tone}`}>
              <metric.icon className="size-5" />
            </span>
            <p className="mt-5 text-3xl font-bold">{metric.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b p-5">
            <h3 className="flex items-center gap-2 font-semibold"><Search className="size-4 text-primary" />{t("searchConsole.topQueries")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-secondary/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3">{t("searchConsole.query")}</th><th className="px-3 py-3">{t("searchConsole.clicks")}</th><th className="px-3 py-3">{t("searchConsole.impressions")}</th><th className="px-3 py-3">CTR</th><th className="px-3 py-3">{t("searchConsole.position")}</th></tr></thead>
              <tbody className="divide-y">
                {data.topQueries.slice(0, 10).map((row) => <tr key={row.key}><td className="max-w-xs truncate px-5 py-3 font-medium">{row.key}</td><td className="px-3 py-3">{formatNumber(row.clicks)}</td><td className="px-3 py-3">{formatNumber(row.impressions)}</td><td className="px-3 py-3">{row.ctr.toFixed(2)}%</td><td className="px-3 py-3">{row.position.toFixed(1)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b p-5">
            <h3 className="flex items-center gap-2 font-semibold"><ExternalLink className="size-4 text-primary" />{t("searchConsole.topPages")}</h3>
          </div>
          <div className="divide-y">
            {data.topPages.slice(0, 10).map((row) => (
              <div key={row.key} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.key}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(row.impressions)} {t("searchConsole.impressions").toLowerCase()} · {t("searchConsole.positionLabel")} {row.position.toFixed(1)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatNumber(row.clicks)}</p>
                  <p className="text-[10px] text-muted-foreground">{row.ctr.toFixed(2)}% CTR</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-semibold"><ArrowDownRight className="size-4 text-destructive" />{t("searchConsole.decliningPages")}</h3>
          <div className="mt-4 space-y-3">
            {data.decliningPages.length ? data.decliningPages.map((page) => (
              <div key={page.key} className="rounded-lg border bg-secondary/20 p-4">
                <p className="truncate text-sm font-medium">{page.key}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="font-semibold text-destructive">{page.clickChange} {t("searchConsole.clicks").toLowerCase()}</span>
                  <span>{page.previousClicks} {t("searchConsole.previous")}</span>
                  <span>{t("searchConsole.positionLabel")} {page.position.toFixed(1)}</span>
                </div>
              </div>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">{t("searchConsole.noDeclines")}</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-warning" />{t("searchConsole.opportunities")}</h3>
          <div className="mt-4 space-y-3">
            {data.opportunities.length ? data.opportunities.map((item) => (
              <div key={item.key} className="rounded-lg border border-warning/15 bg-warning/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{item.key}</p>
                  <Badge variant="warning">{t("searchConsole.positionLabel")} {item.position.toFixed(1)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                <p className="mt-3 text-xs">{formatNumber(item.impressions)} {t("searchConsole.impressions").toLowerCase()} · {item.ctr.toFixed(2)}% CTR</p>
              </div>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">{t("searchConsole.noOpportunities")}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
