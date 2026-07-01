"use client";

import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import type { AiPriority, AiRecommendation, CrawledPage } from "@/types";

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

const priorityConfig: Record<
  AiPriority,
  { labelKey: "aiPanel.highPriority" | "aiPanel.mediumPriority" | "aiPanel.lowPriority"; variant: "destructive" | "warning" | "outline" }
> = {
  high: { labelKey: "aiPanel.highPriority", variant: "destructive" },
  medium: { labelKey: "aiPanel.mediumPriority", variant: "warning" },
  low: { labelKey: "aiPanel.lowPriority", variant: "outline" },
};

export function AiRecommendationsPanel({
  pages,
  initialRecommendations,
  configured,
}: {
  pages: CrawledPage[];
  initialRecommendations: AiRecommendation[];
  configured: boolean;
}) {
  const { t } = useI18n();
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const recommendation = useMemo(
    () => recommendations.find((item) => item.pageId === pageId) ?? null,
    [pageId, recommendations],
  );

  async function analyze() {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/seo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const result = (await response.json()) as {
        data?: AiRecommendation;
        error?: string;
      };
      if (!response.ok || !result.data) {
        throw new Error(result.error ?? t("aiPanel.failed"));
      }
      setRecommendations((current) => [
        result.data!,
        ...current.filter((item) => item.pageId !== result.data!.pageId),
      ]);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : t("aiPanel.unexpected"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!pages.length) {
    return (
      <div className="rounded-xl border border-dashed bg-card/30 p-10 text-center">
        <FileText className="mx-auto size-6 text-primary" />
        <h3 className="mt-4 font-semibold">{t("aiPanel.noPages")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("aiPanel.noPagesDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label htmlFor="ai-page" className="mb-2 block text-sm font-medium">
              {t("aiPanel.analyzedPage")}
            </label>
            <select
              id="ai-page"
              value={pageId}
              onChange={(event) => setPageId(event.target.value)}
              className={selectClassName}
              disabled={isLoading}
            >
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title ?? page.url}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={analyze} disabled={!configured || !pageId || isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isLoading ? t("aiPanel.analyzing") : t("aiPanel.analyze")}
          </Button>
        </div>
        {!configured && (
          <p className="mt-4 flex items-center gap-2 text-xs text-warning">
            <AlertCircle className="size-4" />
            {t("aiPanel.openAiRequired")}
          </p>
        )}
        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />{error}
          </p>
        )}
      </Card>

      {!recommendation ? (
        <div className="rounded-xl border border-dashed bg-card/30 p-10 text-center">
          <Bot className="mx-auto size-7 text-primary" />
          <h3 className="mt-4 font-semibold">{t("aiPanel.notAnalyzed")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("aiPanel.notAnalyzedDescription")}
          </p>
        </div>
      ) : (
        <>
          <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-semibold">{t("aiPanel.scoreExplanation")}</h3>
                </div>
                <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
                  {recommendation.seoScoreExplanation}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{recommendation.model}</p>
                <p className="mt-1 flex items-center justify-end gap-1">
                  <CircleDollarSign className="size-3.5" />
                  €{recommendation.estimatedCostUsd.toFixed(6)} · {recommendation.totalTokens} tokens
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {recommendation.problems.map((problem, index) => {
              const priority = priorityConfig[problem.priority];
              return (
                <Card key={`${problem.problem}-${index}`} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{problem.problem}</h3>
                        <Badge variant={priority.variant}>{t(priority.labelKey)}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{problem.explanation}</p>
                      <p className="mt-3 text-sm">
                        <span className="font-semibold">{t("aiPanel.recommendation")}:</span> {problem.recommendation}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              [t("aiPanel.metaTitle"), recommendation.recommendedMetaTitle],
              [t("aiPanel.metaDescription"), recommendation.recommendedMetaDescription],
              [t("aiPanel.h1"), recommendation.recommendedH1],
            ].map(([label, value]) => (
              <Card key={label} className="p-5">
                <CheckCircle2 className="size-5 text-success" />
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm leading-6">{value}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-semibold">{t("aiPanel.faq")}</h3>
              <div className="mt-4 space-y-4">
                {recommendation.recommendedFaq.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="rounded-lg bg-secondary/40 p-4">
                    <p className="text-sm font-semibold">{item.question}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold"><Link2 className="size-4 text-primary" />{t("aiPanel.internalLinks")}</h3>
              <div className="mt-4 space-y-4">
                {recommendation.internalLinkingSuggestions.map((item, index) => (
                  <div key={`${item.anchorText}-${index}`} className="border-b pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold">{item.anchorText}</p>
                    <p className="mt-1 text-xs text-primary">{item.targetSuggestion}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="font-semibold">{t("aiPanel.contentSuggestions")}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {recommendation.contentSuggestions.map((suggestion, index) => (
                <div key={`${suggestion}-${index}`} className="flex gap-3 rounded-lg bg-secondary/40 p-4 text-sm">
                  <span className="font-semibold text-primary">{index + 1}.</span>
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
