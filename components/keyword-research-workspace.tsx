"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Globe2, ExternalLink, FilePlus2, Filter, Layers3, Loader2, Search, Sparkles } from "lucide-react";
import { useActiveWebsite } from "@/components/active-website-provider";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  KeywordCluster,
  KeywordDifficulty,
  KeywordPriority,
  KeywordResearchDataset,
  KeywordResearchItem,
  SearchIntent,
  Website,
} from "@/types";

const intentLabelKeys = {
  informational: "keywords.intentInformational",
  commercial: "keywords.intentCommercial",
  transactional: "keywords.intentTransactional",
  navigational: "keywords.intentNavigational",
} as const;

const difficultyLabelKeys = {
  low: "keywords.difficultyLowShort",
  medium: "keywords.difficultyMediumShort",
  high: "keywords.difficultyHighShort",
} as const;

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

const difficultyBadge: Record<KeywordDifficulty, "success" | "warning" | "destructive"> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

interface KeywordResearchWorkspaceProps {
  websites: Website[];
  datasets: Record<string, KeywordResearchDataset>;
}

interface GenerateKeywordsResponse {
  source?: "supabase" | "demo";
  warning?: string;
  error?: string;
  data?: {
    keywords: KeywordResearchItem[];
    clusters: KeywordCluster[];
  };
}

interface GeneratePageResponse {
  warning?: string;
  error?: string;
  data?: {
    page: {
      id: string;
    };
  };
}

const statusLabels = {
  planned: "keywords.statusPlanned",
  drafted: "keywords.statusDrafted",
  published: "keywords.statusPublished",
  indexed: "keywords.statusIndexed",
} as const;

const statusBadge = {
  planned: "outline",
  drafted: "warning",
  published: "success",
  indexed: "success",
} as const;

export function KeywordResearchWorkspace({
  websites,
  datasets,
}: KeywordResearchWorkspaceProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWebsiteId, setActiveWebsiteId } = useActiveWebsite();
  const initialWebsiteId = searchParams.get("websiteId");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState(
    websites.some((website) => website.id === initialWebsiteId)
      ? initialWebsiteId ?? websites[0]?.id ?? ""
      : activeWebsiteId && websites.some((website) => website.id === activeWebsiteId)
        ? activeWebsiteId
        : websites[0]?.id ?? "",
  );
  const [keywordData, setKeywordData] = useState<Record<string, KeywordResearchDataset>>(datasets);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<KeywordPriority | "all">("all");
  const [difficulty, setDifficulty] = useState<KeywordDifficulty | "all">("all");
  const [intent, setIntent] = useState<SearchIntent | "all">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [generatingPageKeyword, setGeneratingPageKeyword] = useState<string | null>(null);

  const selectedWebsite = websites.find((website) => website.id === selectedWebsiteId) ?? websites[0];
  const selectedData = selectedWebsite
    ? keywordData[selectedWebsite.id] ??
      ({ source: "supabase", keywords: [], clusters: [] } satisfies KeywordResearchDataset)
    : ({ source: "supabase", keywords: [], clusters: [] } satisfies KeywordResearchDataset);

  const filteredKeywords = useMemo(() => {
    return selectedData.keywords.filter((item) => {
      const matchesQuery =
        !query ||
        item.keyword.toLowerCase().includes(query.toLowerCase()) ||
        item.suggestedTitle.toLowerCase().includes(query.toLowerCase());
      const matchesPriority = priority === "all" || item.priority === priority;
      const matchesDifficulty = difficulty === "all" || item.difficulty === difficulty;
      const matchesIntent = intent === "all" || item.searchIntent === intent;

      return matchesQuery && matchesPriority && matchesDifficulty && matchesIntent;
    });
  }, [difficulty, intent, priority, query, selectedData.keywords]);

  useEffect(() => {
    const urlWebsiteId = searchParams.get("websiteId");
    if (urlWebsiteId && websites.some((website) => website.id === urlWebsiteId)) {
      setSelectedWebsiteId(urlWebsiteId);
      setActiveWebsiteId(urlWebsiteId);
    }
  }, [searchParams, setActiveWebsiteId, websites]);

  function handleWebsiteChange(nextWebsiteId: string) {
    setSelectedWebsiteId(nextWebsiteId);
    setActiveWebsiteId(nextWebsiteId);
    setQuery("");
    setPriority("all");
    setDifficulty("all");
    setIntent("all");
    setMessage(null);
    router.push(`/keywords?websiteId=${encodeURIComponent(nextWebsiteId)}`);
  }

  async function generateKeywords() {
    if (!selectedWebsite) return;

    setMessage(null);
    setIsGeneratingKeywords(true);

    try {
      const response = await fetch("/api/keywords/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: selectedWebsite.id }),
      });

      const payload = (await response.json()) as GenerateKeywordsResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? t("keywords.generateGenericFailed"));
      }

      if (payload.data) {
        setKeywordData((current) => ({
          ...current,
          [selectedWebsite.id]: {
            source: payload.source ?? "supabase",
            keywords: payload.data?.keywords ?? [],
            clusters: payload.data?.clusters ?? [],
          },
        }));
      }

      setMessage(
          payload.warning ??
          `${t("keywords.generatedFor")} ${selectedWebsite.name}. ${t("keywords.savedInPlatform")}`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("keywords.generateFailed"));
    } finally {
      setIsGeneratingKeywords(false);
    }
  }

  async function generatePage(item: KeywordResearchItem) {
    if (!selectedWebsite) return;

    setMessage(null);
    setGeneratingPageKeyword(item.keyword);

    try {
      const response = await fetch("/api/content/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: selectedWebsite.id,
          keyword: item.keyword,
          suggestedTitle: item.suggestedTitle,
          suggestedMetaDescription: item.suggestedMetaDescription,
          suggestedSlug: item.suggestedSlug,
          contentType: item.contentType,
          searchIntent: item.searchIntent,
        }),
      });

      const payload = (await response.json()) as GeneratePageResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? t("keywords.pageGenerateFailed"));
      }

      setKeywordData((current) => {
        const currentDataset = current[selectedWebsite.id] ?? selectedData;
        return {
          ...current,
          [selectedWebsite.id]: {
            ...currentDataset,
            keywords: currentDataset.keywords.map((keyword) =>
              keyword.id === item.id ? { ...keyword, status: "drafted" } : keyword,
            ),
            generatedPages: {
              ...(currentDataset.generatedPages ?? {}),
              [item.keyword]: {
                id: payload.data?.page.id ?? "",
                status: "draft",
              },
            },
          },
        };
      });
      setMessage(payload.warning ?? `${t("keywords.pageGeneratedFor")} „${item.keyword}”.`);
      router.push(`/content/generated?websiteId=${selectedWebsite.id}&pageId=${payload.data?.page.id ?? ""}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("keywords.pageGenerateFailed"));
    } finally {
      setGeneratingPageKeyword(null);
    }
  }

  if (!selectedWebsite) {
    return (
      <EmptyState
        icon={Globe2}
        title={t("keywords.noWebsites")}
        description={t("keywords.noWebsitesDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Website</span>
              <select
                className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={selectedWebsiteId}
                onChange={(event) => handleWebsiteChange(event.target.value)}
              >
                {websites.map((website) => (
                  <option key={website.id} value={website.id}>
                    {website.name} - {website.url.replace("https://", "")}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-3">
              {selectedData.source !== "supabase" ? (
                <Badge variant="warning">{t("websites.previewMode")}</Badge>
              ) : null}
              <span className="text-sm text-muted-foreground">
                {selectedData.keywords.length} {t("keywords.opportunities")}
              </span>
            </div>
          </div>
          <Button onClick={generateKeywords} disabled={isGeneratingKeywords}>
            {isGeneratingKeywords ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isGeneratingKeywords ? t("keywords.generating") : t("keywords.generateAi")}
          </Button>
        </div>
        {(message || selectedData.error) && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{message ?? selectedData.error}</span>
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("keywords.keywords"), selectedData.keywords.length.toString()],
          [t("keywords.highPriority"), selectedData.keywords.filter((item) => item.priority === "high").length.toString()],
          [t("keywords.clusters"), selectedData.clusters.length.toString()],
          [t("keywords.plannedContent"), selectedData.keywords.filter((item) => item.status === "planned").length.toString()],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("keywords.searchPlaceholder")}
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={priority}
          onChange={(event) => setPriority(event.target.value as KeywordPriority | "all")}
        >
          <option value="all">{t("keywords.allPriorities")}</option>
          <option value="high">{t("keywords.priorityHigh")}</option>
          <option value="medium">{t("keywords.priorityMedium")}</option>
          <option value="low">{t("keywords.priorityLow")}</option>
        </select>
        <select
          className="h-10 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value as KeywordDifficulty | "all")}
        >
          <option value="all">{t("keywords.allDifficulties")}</option>
          <option value="low">{t("keywords.difficultyLow")}</option>
          <option value="medium">{t("keywords.difficultyMedium")}</option>
          <option value="high">{t("keywords.difficultyHigh")}</option>
        </select>
        <select
          className="h-10 rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          value={intent}
          onChange={(event) => setIntent(event.target.value as SearchIntent | "all")}
        >
          <option value="all">{t("keywords.allIntents")}</option>
          <option value="informational">{t("keywords.intentInformational")}</option>
          <option value="commercial">{t("keywords.intentCommercial")}</option>
          <option value="transactional">{t("keywords.intentTransactional")}</option>
          <option value="navigational">{t("keywords.intentNavigational")}</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {selectedData.clusters.map((cluster) => (
          <Card key={cluster.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Layers3 className="size-5" />
              </span>
              <Badge variant={priorityBadge[cluster.priority]}>
                {t(priorityLabelKeys[cluster.priority])}
              </Badge>
            </div>
            <h3 className="mt-4 font-semibold">{cluster.clusterName}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("keywords.main")}: {cluster.mainKeyword}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {cluster.relatedKeywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {selectedData.keywords.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t("keywords.emptyTitle")}
          description={t("keywords.emptyDescription")}
          action={t("keywords.emptyAction")}
          onAction={generateKeywords}
        />
      ) : filteredKeywords.length === 0 ? (
        <EmptyState
          icon={Filter}
          title={t("keywords.noFilterResultsTitle")}
          description={t("keywords.noFilterResultsDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] text-left">
              <thead className="border-b bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5">Keyword</th>
                  <th className="px-5 py-3.5">{t("keywords.intent")}</th>
                  <th className="px-5 py-3.5">{t("keywords.difficulty")}</th>
                  <th className="px-5 py-3.5">{t("keywords.priority")}</th>
                  <th className="px-5 py-3.5">{t("keywords.contentType")}</th>
                  <th className="px-5 py-3.5">{t("keywords.recommendedTitle")}</th>
                  <th className="px-5 py-3.5">{t("keywords.generatedPage")}</th>
                  <th className="px-5 py-3.5">{t("keywords.status")}</th>
                  <th className="px-5 py-3.5">{t("keywords.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredKeywords.map((item) => {
                  const generatedPage = selectedData.generatedPages?.[item.keyword];
                  const generatedPageHref = generatedPage
                    ? `/content/generated?websiteId=${encodeURIComponent(item.websiteId)}&pageId=${encodeURIComponent(generatedPage.id)}`
                    : null;
                  const hasDraft = item.status === "drafted" && generatedPageHref;

                  return (
                    <tr key={item.id} className="hover:bg-secondary/30">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium">{item.keyword}</p>
                        <p className="mt-1 text-xs text-muted-foreground">/{item.suggestedSlug}</p>
                      </td>
                      <td className="px-5 py-4 text-sm">{t(intentLabelKeys[item.searchIntent])}</td>
                      <td className="px-5 py-4">
                        <Badge variant={difficultyBadge[item.difficulty]}>
                          {t(difficultyLabelKeys[item.difficulty])}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={priorityBadge[item.priority]}>{t(priorityLabelKeys[item.priority])}</Badge>
                      </td>
                      <td className="px-5 py-4 text-sm">{item.contentType}</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium">{item.suggestedTitle}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {item.suggestedMetaDescription}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {generatedPageHref ? (
                          <Button asChild size="sm" variant="ghost" className="px-0 text-primary hover:bg-transparent hover:text-primary/80">
                            <Link href={generatedPageHref}>
                              <ExternalLink className="size-3.5" />
                              {t("keywords.openPage")}
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("keywords.notYet")}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={statusBadge[item.status]}>
                          {t(statusLabels[item.status])}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        {hasDraft ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={generatedPageHref}>
                              <ExternalLink className="size-3.5" />
                              {t("keywords.openDraft")}
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generatePage(item)}
                            disabled={generatingPageKeyword === item.keyword}
                          >
                            {generatingPageKeyword === item.keyword ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <FilePlus2 className="size-3.5" />
                            )}
                            {t("keywords.generatePage")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
