import { AlertCircle, Globe2, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WebsiteTable } from "@/components/website-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";
import { getWebsites } from "@/lib/supabase/websites";

export const metadata = { title: "Websites" };

export const dynamic = "force-dynamic";

export default async function WebsitesPage() {
  const { locale, t } = await getServerTranslator();
  const { websites, source, error } = await getWebsites();
  const averageScore = websites.length
    ? websites.reduce((total, website) => total + website.score, 0) / websites.length
    : 0;
  const totalPages = websites.reduce((total, website) => total + website.pages, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("websites.eyebrow")}
        title={t("nav.websites")}
        description={t("websites.description")}
        actions={<Button asChild><Link href="/websites/new"><Plus className="size-4" />{t("dashboard.addWebsite")}</Link></Button>}
      />

      {error && (
        <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {source !== "supabase" ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{t("websites.previewMode")}</Badge>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">{t("websites.total")}</p><div className="mt-3 flex items-center gap-3"><Globe2 className="size-5 text-primary" /><span className="text-2xl font-bold">{websites.length}</span></div></div>
        <div className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">{t("websites.averageSeoScore")}</p><div className="mt-3 flex items-center gap-3"><span className="size-3 rounded-full bg-success" /><span className="text-2xl font-bold">{averageScore.toLocaleString(locale === "ro" ? "ro-RO" : "en-US", { maximumFractionDigits: 1 })}</span></div></div>
        <div className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">{t("websites.monitoredPages")}</p><div className="mt-3 flex items-center gap-3"><span className="size-3 rounded-full bg-primary" /><span className="text-2xl font-bold">{totalPages}</span></div></div>
      </div>

      {websites.length ? (
        <WebsiteTable
          data={websites}
          labels={{
            seoScore: t("dashboard.seoScore"),
            pages: t("website.pages"),
            status: t("websites.status"),
            lastAudit: t("websites.lastAudit"),
            actions: t("websites.actions"),
            details: t("websites.details"),
            detailsTooltip: t("websites.detailsTooltip"),
            crawlTooltip: t("websites.crawlTooltip"),
            auditTooltip: t("websites.auditTooltip"),
            delete: t("websites.delete"),
            deleteTooltip: t("websites.deleteTooltip"),
            deleteTitle: t("websites.deleteTitle"),
            deleteDescription: t("websites.deleteDescription"),
            deleteCancel: t("websites.deleteCancel"),
            deleteConfirm: t("websites.deleteConfirm"),
            deleteSuccess: t("websites.deleteSuccess"),
            deleteFailed: t("websites.deleteFailed"),
          }}
        />
      ) : (
        <EmptyState
          icon={Globe2}
          title={t("websites.emptyTitle")}
          description={t("websites.emptyDescription")}
          action={t("dashboard.addWebsite")}
          actionHref="/websites/new"
        />
      )}
    </div>
  );
}
