"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, useTransition } from "react";
import { AlertCircle, CalendarDays, FileText, Loader2, Sparkles, X } from "lucide-react";
import { useActiveWebsite } from "@/components/active-website-provider";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ContentPlanDataset, ContentPlanItem, KeywordPriority, Website } from "@/types";

const priorityLabelKeys = {
  high: "keywords.priorityHighShort",
  medium: "keywords.priorityMediumShort",
  low: "keywords.priorityLowShort",
} as const;

const priorityBadge: Record<KeywordPriority, "success" | "warning" | "outline"> = {
  high: "success",
  medium: "warning",
  low: "outline",
};

interface ContentPlanWorkspaceProps {
  websites: Website[];
  datasets: Record<string, ContentPlanDataset>;
  onGenerateDocument?: (plan: ContentPlanItem, websiteId: string) => void;
}

interface ContentPlanResponse {
  source?: "supabase" | "demo";
  warning?: string;
  error?: string;
  data?: {
    plans: ContentPlanItem[];
  };
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ContentPlanWorkspace({ websites, datasets, onGenerateDocument }: ContentPlanWorkspaceProps) {
  const { locale, t } = useI18n();
  const { activeWebsiteId, setActiveWebsiteId } = useActiveWebsite();
  const [selectedWebsiteId, setSelectedWebsiteId] = useState(activeWebsiteId || websites[0]?.id || "");
  const [planData, setPlanData] = useState<Record<string, ContentPlanDataset>>(datasets);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ContentPlanItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedWebsite = websites.find((website) => website.id === selectedWebsiteId) ?? websites[0];
  const selectedData = selectedWebsite
    ? planData[selectedWebsite.id] ?? ({ source: "supabase", plans: [] } satisfies ContentPlanDataset)
    : ({ source: "supabase", plans: [] } satisfies ContentPlanDataset);

  useEffect(() => {
    if (activeWebsiteId && activeWebsiteId !== selectedWebsiteId) {
      setSelectedWebsiteId(activeWebsiteId);
      setMessage(null);
    }
  }, [activeWebsiteId, selectedWebsiteId]);

  async function generateContentPlan() {
    if (!selectedWebsite) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/content/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteId: selectedWebsite.id }),
        });

        const payload = (await response.json()) as ContentPlanResponse;
        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? t("keywords.generateGenericFailed"));
        }

        if (payload.data) {
          setPlanData((current) => ({
            ...current,
            [selectedWebsite.id]: {
              source: payload.source ?? "supabase",
              plans: payload.data?.plans ?? [],
            },
          }));
        }

        setMessage(
          payload.warning ??
            `${t("contentPlan.generatedFor")} ${selectedWebsite.name}. ${t("contentPlan.savedInPlatform")}`,
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : t("contentPlan.generateFailed"));
      }
    });
  }

  if (!selectedWebsite) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t("contentPlan.noWebsites")}
        description={t("contentPlan.noWebsitesDescription")}
      />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">{t("contentPlan.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("contentPlan.description")}
            </p>
          </div>
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Website</span>
            <select
              className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={selectedWebsiteId}
              onChange={(event) => {
                setSelectedWebsiteId(event.target.value);
                setActiveWebsiteId(event.target.value);
                setMessage(null);
              }}
            >
              {websites.map((website) => (
                <option key={website.id} value={website.id}>
                  {website.name} - {website.url.replace("https://", "")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {selectedData.source !== "supabase" ? (
            <Badge variant="warning">{t("websites.previewMode")}</Badge>
          ) : null}
          <Button onClick={generateContentPlan} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {t("contentPlan.generate")}
          </Button>
        </div>
      </div>

      {(message || selectedData.error) && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{message ?? selectedData.error}</span>
        </div>
      )}

      {selectedData.plans.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("contentPlan.noPlan")}
          description={t("contentPlan.noPlanDescription")}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {selectedData.plans.map((plan) => (
            <Card key={plan.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-primary">{selectedWebsite.name}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{t("contentPlan.generatedAt")}: {formatDateTime(plan.createdAt, locale)}</p>
                  <h3 className="mt-2 font-[var(--font-manrope)] text-lg font-bold">{plan.title}</h3>
                </div>
                <div className="flex gap-2">
                  <Badge variant={priorityBadge[plan.priority]}>
                    {t("contentPlan.priority")} {t(priorityLabelKeys[plan.priority])}
                  </Badge>
                  <Badge variant="outline">{plan.status}</Badge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t("contentPlan.planMonth")}</p>
                  <p className="mt-1 font-medium">{plan.month}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("content.targetKeyword")}</p>
                  <p className="mt-1 font-medium">{plan.targetKeyword}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("contentPlan.contentType")}</p>
                  <p className="mt-1 font-medium">{plan.contentType}</p>
                </div>
              </div>
              <div className="mt-5 rounded-xl border bg-secondary/20 p-4">
                <p className="text-xs font-semibold text-muted-foreground">{t("contentPlan.shortOutline")}</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {plan.outline.slice(0, 5).map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="sm" onClick={() => onGenerateDocument?.(plan, selectedWebsite.id)}>
                  {t("contentPlan.generateDocument")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(plan)}>
                  {t("contentPlan.viewDetails")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog.Root open={Boolean(selectedPlan)} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
            {selectedPlan ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-xl font-semibold">{selectedPlan.title}</Dialog.Title>
                    <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                      {selectedWebsite.name} · {t("contentPlan.generatedAt")}: {formatDateTime(selectedPlan.createdAt, locale)}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon">
                      <X className="size-4" />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border bg-background/40 p-4">
                    <p className="text-xs text-muted-foreground">{t("content.targetKeyword")}</p>
                    <p className="mt-1 font-medium">{selectedPlan.targetKeyword}</p>
                  </div>
                  <div className="rounded-xl border bg-background/40 p-4">
                    <p className="text-xs text-muted-foreground">{t("contentPlan.contentType")}</p>
                    <p className="mt-1 font-medium">{selectedPlan.contentType}</p>
                  </div>
                  <div className="rounded-xl border bg-background/40 p-4">
                    <p className="text-xs text-muted-foreground">{t("contentPlan.priority")}</p>
                    <p className="mt-1 font-medium">{t(priorityLabelKeys[selectedPlan.priority])}</p>
                  </div>
                  <div className="rounded-xl border bg-background/40 p-4">
                    <p className="text-xs text-muted-foreground">{t("content.status")}</p>
                    <p className="mt-1 font-medium">{selectedPlan.status}</p>
                  </div>
                </div>
                <div className="rounded-xl border bg-secondary/20 p-4">
                  <p className="text-sm font-semibold">{t("contentPlan.outline")}</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {selectedPlan.outline.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end border-t pt-5">
                  <Button onClick={() => onGenerateDocument?.(selectedPlan, selectedWebsite.id)}>
                    {t("contentPlan.generateDocument")}
                  </Button>
                </div>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
