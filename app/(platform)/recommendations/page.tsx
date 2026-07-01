import {
  ArrowRight,
  FileSearch,
  Lightbulb,
  PenLine,
  Rocket,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  getRecommendationHref,
  getSeoRecommendations,
  type RecommendationActionType,
  type RecommendationImpact,
  type RecommendationStatus,
} from "@/lib/supabase/recommendations";

export const metadata = { title: "AI Recommendations" };
export const dynamic = "force-dynamic";

function matchesWebsite(websiteId: string | undefined, itemWebsiteId: string) {
  if (!websiteId) return true;
  return websiteId === itemWebsiteId;
}

const actionIcons: Record<RecommendationActionType, typeof FileSearch> = {
  audit: FileSearch,
  optimize: PenLine,
  content: Sparkles,
  crawl: ScanSearch,
};

function impactVariant(impact: RecommendationImpact) {
  if (impact === "High" || impact === "Ridicat") return "destructive";
  if (impact === "Medium" || impact === "Mediu") return "warning";
  return "outline";
}

function statusVariant(status: RecommendationStatus) {
  if (status === "Resolved" || status === "Rezolvat") return "success";
  if (status === "Draft" || status === "In progress" || status === "În lucru") return "warning";
  return "default";
}

function impactKey(impact: RecommendationImpact) {
  if (impact === "High" || impact === "Ridicat") return "recommendations.impactHigh";
  if (impact === "Medium" || impact === "Mediu") return "recommendations.impactMedium";
  return "recommendations.impactLow";
}

function statusKey(status: RecommendationStatus) {
  if (status === "Resolved" || status === "Rezolvat") return "recommendations.statusResolved";
  if (status === "Draft") return "recommendations.statusDraft";
  if (status === "In progress" || status === "În lucru") return "recommendations.statusInProgress";
  return "recommendations.statusPlanned";
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ websiteId?: string }>;
}) {
  const params = await searchParams;
  const { t } = await getServerTranslator();
  const { recommendations, source, error } = await getSeoRecommendations();
  const visibleRecommendations = recommendations.filter((item) =>
    matchesWebsite(params?.websiteId, item.websiteId),
  );
  const highImpact = visibleRecommendations.filter((item) => item.impact === "High" || item.impact === "Ridicat").length;
  const inProgress = visibleRecommendations.filter((item) =>
    ["In progress", "În lucru", "Draft", "Planned", "Planificat", "New", "Nou"].includes(item.status),
  ).length;
  const actionLabels: Record<RecommendationActionType, string> = {
    audit: t("recommendations.openAudit"),
    optimize: t("recommendations.optimizePage"),
    content: t("recommendations.generateContent"),
    crawl: t("recommendations.runCrawl"),
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("recommendations.eyebrow")}
        title={t("recommendations.title")}
        description={t("recommendations.description")}
        actions={
          <Button asChild>
            <Link href="/assistant">
              <Sparkles className="size-4" />
              {t("recommendations.askCopilot")}
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {error}
        </div>
      ) : null}

      {source !== "supabase" ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{t("websites.previewMode")}</Badge>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("recommendations.total")}</p>
          <p className="mt-3 text-3xl font-bold">{visibleRecommendations.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("recommendations.highImpact")}</p>
          <p className="mt-3 text-3xl font-bold">{highImpact}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("recommendations.inProgress")}</p>
          <p className="mt-3 text-3xl font-bold">{inProgress}</p>
        </Card>
      </div>

      <SectionCard
        title={t("recommendations.prioritized")}
        description={t("recommendations.prioritizedDescription")}
      >
        {visibleRecommendations.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title={t("recommendations.emptyTitle")}
            description={t("recommendations.emptyDescription")}
          />
        ) : (
          <div className="space-y-4">
          {visibleRecommendations.map((item) => {
            const ActionIcon = actionIcons[item.actionType];

            return (
              <Card key={item.id} className="p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <Lightbulb className="size-4" />
                      </span>
                      <Badge variant="outline">{item.type}</Badge>
                      <Badge variant={impactVariant(item.impact)}>
                        {t("recommendations.impact")} {t(impactKey(item.impact))}
                      </Badge>
                      <Badge variant={statusVariant(item.status)}>{t(statusKey(item.status))}</Badge>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
                      <div className="rounded-xl border bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">{t("recommendations.affectedWebsite")}</p>
                        <p className="mt-1 text-sm font-medium">{item.websiteName}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.websiteUrl}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-background/40 p-3">
                        <p className="text-xs text-muted-foreground">{t("recommendations.recommendedAction")}</p>
                        <p className="mt-1 text-sm leading-6">{item.recommendedAction}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:w-56 xl:grid-cols-1">
                    <Button asChild>
                      <Link href={getRecommendationHref(item.actionType, item.websiteId)}>
                        <ActionIcon className="size-4" />
                        {actionLabels[item.actionType]}
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/crawl?websiteId=${encodeURIComponent(item.websiteId)}`}>
                        <Rocket className="size-4" />
                        {t("recommendations.runCrawl")}
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link href={`/websites/${encodeURIComponent(item.websiteId)}`}>
                        {t("recommendations.websiteDetails")}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
