"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Eye,
  ImageIcon,
  Link2,
  Loader2,
  Rocket,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type {
  GeneratedPage,
  GeneratedPageContent,
  GeneratedPageSection,
  GeneratedPagesDataset,
  GeneratedPageStatus,
  Website,
} from "@/types";

const statusLabels: Record<GeneratedPageStatus, DictionaryKey> = {
  draft: "content.statusDraft",
  review: "content.statusReview",
  approved: "generated.statusApproved",
  published: "content.statusPublished",
};

const workflowSteps = [
  "content.statusDraft",
  "content.statusReview",
  "generated.statusApproved",
  "content.statusPublished",
  "generated.submitSitemap",
  "generated.requestIndexing",
  "generated.monitorPosition",
] as const;

interface GeneratedPageEditorProps {
  websites: Website[];
  dataset: GeneratedPagesDataset;
}

interface SaveResponse {
  error?: string;
  data?: {
    page: GeneratedPage;
  };
}

interface SeoCheck {
  label: string;
  passed: boolean;
  score: number;
  detail: string;
}

function getPlainText(page: GeneratedPage) {
  return [
    page.metaTitle,
    page.metaDescription,
    page.slug,
    page.content.h1,
    page.content.introduction,
    ...page.content.sections.flatMap((section) => [
      section.h2,
      section.intro,
      ...section.h3,
      ...section.paragraphs,
    ]),
    ...page.content.faq.flatMap((item) => [item.question, item.answer]),
    page.content.cta,
  ].join(" ");
}

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getGenericLinkTargets(page: GeneratedPage, website?: Website) {
  const baseKeyword = page.keyword.trim();
  const niche = website?.niche?.trim();
  const anchors = [
    baseKeyword,
    page.content.sections[0]?.h2,
    page.content.sections[1]?.h2,
    niche,
    website?.name,
  ]
    .filter((value): value is string => Boolean(value && value.length > 2))
    .filter((value, index, array) => array.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 5);

  return anchors.map((anchorText) => ({
    anchorText,
    targetSuggestion: `/${slugify(anchorText) || page.slug}`,
  }));
}

function countOccurrences(text: string, keyword: string) {
  if (!keyword.trim()) return 0;
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...text.matchAll(new RegExp(escaped, "giu"))].length;
}

function toneForLength(value: number, goodMin: number, goodMax: number, warnMin: number, warnMax: number) {
  if (value >= goodMin && value <= goodMax) return "success";
  if (value >= warnMin && value <= warnMax) return "warning";
  return "destructive";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function indicatorClass(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning";
  return "bg-destructive";
}

function titleFeedback(length: number, t: ReturnType<typeof useI18n>["t"]) {
  if (length < 30) return t("generated.titleTooShort");
  if (length > 60) return t("generated.titleTooLong");
  return t("generated.titleGood");
}

function metaFeedback(length: number, t: ReturnType<typeof useI18n>["t"]) {
  if (length < 120) return t("generated.metaTooShort");
  if (length > 160) return t("generated.metaTooLong");
  return t("generated.metaGood");
}

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

function updateSection(
  sections: GeneratedPageSection[],
  index: number,
  updater: (section: GeneratedPageSection) => GeneratedPageSection,
) {
  return sections.map((section, sectionIndex) => (sectionIndex === index ? updater(section) : section));
}

function buildFaqSchema(page: GeneratedPage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.content.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function analyzePage(page: GeneratedPage, t: ReturnType<typeof useI18n>["t"]) {
  const text = getPlainText(page);
  const wordList = words(text);
  const wordCount = wordList.length;
  const keywordCount = countOccurrences(text, page.keyword);
  const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
  const h1Keyword = page.content.h1.toLowerCase().includes(page.keyword.toLowerCase());
  const h2KeywordCount = page.content.sections.filter((section) =>
    section.h2.toLowerCase().includes(page.keyword.toLowerCase()),
  ).length;
  const paragraphKeywordCount = page.content.sections.reduce(
    (total, section) => total + countOccurrences([section.intro, ...section.paragraphs].join(" "), page.keyword),
    0,
  );
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const averageSentenceLength = sentences.length ? wordCount / sentences.length : 0;
  const paragraphs = [
    page.content.introduction,
    ...page.content.sections.flatMap((section) => [section.intro, ...section.paragraphs]),
  ];
  const longParagraphs = paragraphs.filter((paragraph) => words(paragraph).length > 90).length;
  const passiveSignals = ["este realizat", "sunt create", "este oferit", "sunt livrate", "a fost"];
  const passiveCount = passiveSignals.reduce(
    (total, signal) => total + countOccurrences(text, signal),
    0,
  );
  const repeatedWords = Object.entries(
    wordList.reduce<Record<string, number>>((acc, word) => {
      if (word.length > 5) acc[word] = (acc[word] ?? 0) + 1;
      return acc;
    }, {}),
  ).filter(([, count]) => count > 8).length;

  const readabilityScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        Math.max(0, averageSentenceLength - 18) * 2 -
        longParagraphs * 8 -
        passiveCount * 5 -
        repeatedWords * 4,
    ),
  );

  const eeatSignals = [
    /company|brand|team|studio|agency|business|companie|brand|echipă|studio|agenție|cofetărie/i.test(text),
    /experience|portfolio|projects|clients|events|case studies|experiență|portofoliu|proiecte|clienți|evenimente/i.test(text),
    /trust|quality|professional|safety|transparent|certified|încredere|calitate|profesionist|siguranță|transparent/i.test(text),
    /contact|consultation|order|request|quote|contact|consultație|comandă|solicită|scrie-ne/i.test(text),
    Boolean(page.content.cta),
  ];
  const eeatScore = Math.round((eeatSignals.filter(Boolean).length / eeatSignals.length) * 100);

  const internalLinks = page.content.internalLinks.length;
  const externalLinks = 0;
  const imageCount = 0;
  const altTextCount = 0;
  const hasSchema = Boolean(page.faqSchema && Object.keys(page.faqSchema).length);
  const slugOk = page.slug.length >= 5 && page.slug.length <= 70 && /^[a-z0-9-]+$/.test(page.slug);
  const titleLength = page.metaTitle.length;
  const metaLength = page.metaDescription.length;
  const contentLengthOk = wordCount >= 700;
  const densityOk = density >= 0.6 && density <= 2.5;

  const checks: SeoCheck[] = [
    { label: "SEO Title", passed: titleLength >= 30 && titleLength <= 60, score: titleLength >= 30 && titleLength <= 60 ? 8 : 3, detail: titleFeedback(titleLength, t) },
    { label: "Meta Description", passed: metaLength >= 120 && metaLength <= 160, score: metaLength >= 120 && metaLength <= 160 ? 8 : 3, detail: metaFeedback(metaLength, t) },
    { label: "H1", passed: Boolean(page.content.h1), score: page.content.h1 ? 6 : 0, detail: page.content.h1 ? t("generated.h1Present") : t("generated.h1Missing") },
    { label: "H2", passed: page.content.sections.length >= 5, score: page.content.sections.length >= 5 ? 6 : 2, detail: t("generated.h2Detail") },
    { label: t("generated.contentLength"), passed: contentLengthOk, score: contentLengthOk ? 8 : 3, detail: `${wordCount} ${t("generated.wordTarget")}` },
    { label: t("generated.primaryKeyword"), passed: h1Keyword && h2KeywordCount > 0, score: h1Keyword && h2KeywordCount > 0 ? 7 : 3, detail: t("generated.keywordPlacement") },
    { label: "Keyword density", passed: densityOk, score: densityOk ? 7 : 3, detail: `${density.toFixed(2)}% ${t("generated.keywordDensityDetail")}` },
    { label: "Internal links", passed: internalLinks >= 3, score: internalLinks >= 3 ? 6 : 2, detail: `${internalLinks} ${t("generated.internalLinkSuggestions")}` },
    { label: "External links", passed: externalLinks > 0, score: externalLinks > 0 ? 4 : 1, detail: t("generated.externalLinksDetail") },
    { label: "FAQ", passed: page.content.faq.length >= 4, score: page.content.faq.length >= 4 ? 6 : 2, detail: `${page.content.faq.length} ${t("generated.faqQuestions")}` },
    { label: "Schema.org", passed: hasSchema, score: hasSchema ? 5 : 0, detail: hasSchema ? t("generated.schemaPresent") : t("generated.schemaMissing") },
    { label: "Slug", passed: slugOk, score: slugOk ? 5 : 2, detail: slugOk ? t("generated.slugOptimized") : t("generated.slugDetail") },
    { label: "Readability", passed: readabilityScore >= 70, score: readabilityScore >= 70 ? 7 : 3, detail: `Readability ${Math.round(readabilityScore)}/100.` },
    { label: "CTA", passed: page.content.cta.length > 8, score: page.content.cta.length > 8 ? 5 : 0, detail: page.content.cta ? t("generated.ctaPresent") : t("generated.ctaMissing") },
    { label: t("generated.images"), passed: imageCount > 0, score: imageCount > 0 ? 3 : 1, detail: t("generated.noImagesYet") },
    { label: "ALT text", passed: imageCount > 0 && altTextCount === imageCount, score: imageCount > 0 && altTextCount === imageCount ? 3 : 1, detail: t("generated.altWhenMedia") },
    { label: "Canonical", passed: slugOk, score: slugOk ? 3 : 1, detail: t("generated.canonicalDetail") },
    { label: "Open Graph", passed: titleLength > 0 && metaLength > 0, score: titleLength > 0 && metaLength > 0 ? 3 : 1, detail: t("generated.ogDetail") },
    { label: "Twitter Cards", passed: titleLength > 0 && metaLength > 0, score: titleLength > 0 && metaLength > 0 ? 3 : 1, detail: t("generated.twitterDetail") },
  ];

  const score = Math.round(
    checks.reduce((total, check) => total + check.score, 0) /
      checks.reduce((total, check) => total + Math.max(check.score, check.passed ? check.score : 8), 0) *
      100,
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    checks,
    wordCount,
    keywordCount,
    density,
    h1Keyword,
    h2KeywordCount,
    paragraphKeywordCount,
    readabilityScore: Math.round(readabilityScore),
    averageSentenceLength,
    longParagraphs,
    passiveCount,
    repeatedWords,
    eeatScore,
    internalLinks,
    imageCount,
  };
}

export function GeneratedPageEditor({ websites, dataset }: GeneratedPageEditorProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialWebsiteId = searchParams.get("websiteId");
  const initialPageId = searchParams.get("pageId");
  const filteredInitialPages = initialWebsiteId
    ? dataset.pages.filter((page) => page.websiteId === initialWebsiteId)
    : dataset.pages;
  const initialPages = filteredInitialPages.length ? filteredInitialPages : dataset.pages;
  const [pages, setPages] = useState(dataset.pages);
  const [selectedPageId, setSelectedPageId] = useState(
    dataset.pages.some((page) => page.id === initialPageId)
      ? initialPageId ?? initialPages[0]?.id ?? ""
      : initialPages[0]?.id ?? "",
  );
  const [message, setMessage] = useState<string | null>(dataset.error ?? null);
  const [isPending, startTransition] = useTransition();

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  const website = selectedPage
    ? websites.find((item) => item.id === selectedPage.websiteId)
    : undefined;
  const analysis = useMemo(() => (selectedPage ? analyzePage(selectedPage, t) : null), [selectedPage, t]);
  const faqSchemaText = useMemo(() => {
    if (!selectedPage) return "";
    return JSON.stringify(selectedPage.faqSchema, null, 2);
  }, [selectedPage]);

  function updateSelectedPage(updater: (page: GeneratedPage) => GeneratedPage) {
    if (!selectedPage) return;
    setPages((current) => current.map((page) => (page.id === selectedPage.id ? updater(page) : page)));
  }

  function updateContent(updater: (content: GeneratedPageContent) => GeneratedPageContent) {
    updateSelectedPage((page) => ({
      ...page,
      content: updater(page.content),
    }));
  }

  function insertInternalLinks() {
    if (!selectedPage) return;
    const linkTargets = getGenericLinkTargets(selectedPage, website);
    updateContent((content) => ({
      ...content,
      internalLinks: linkTargets.map((link) => ({
        ...link,
        reason: interpolate(t("generated.internalLinkReason"), { anchor: link.anchorText }),
      })),
    }));
    setMessage(t("generated.internalLinksInserted"));
  }

  function regenerateFaq() {
    if (!selectedPage) return;
    updateSelectedPage((page) => {
      const faq = [
        {
          question: interpolate(t("generated.faqServiceQuestion"), { keyword: page.keyword }),
          answer: t("generated.faqServiceAnswer"),
        },
        {
          question: interpolate(t("generated.faqDurationQuestion"), { keyword: page.keyword }),
          answer: t("generated.faqDurationAnswer"),
        },
        {
          question: interpolate(t("generated.faqImportanceQuestion"), { keyword: page.keyword }),
          answer: t("generated.faqImportanceAnswer"),
        },
        {
          question: t("generated.faqOfferQuestion"),
          answer: t("generated.faqOfferAnswer"),
        },
      ];
      const nextPage = {
        ...page,
        content: {
          ...page.content,
          faq,
        },
      };

      return {
        ...nextPage,
        faqSchema: buildFaqSchema(nextPage),
      };
    });
    setMessage(t("generated.faqUpdated"));
  }

  async function savePage() {
    if (!selectedPage) return;

    if (selectedPage.id.startsWith("demo-")) {
      setMessage(t("generated.demoCannotSave"));
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/content/generated/${selectedPage.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: selectedPage.title,
            metaTitle: selectedPage.metaTitle,
            metaDescription: selectedPage.metaDescription,
            slug: selectedPage.slug,
            status: selectedPage.status,
            content: selectedPage.content,
            faqSchema: selectedPage.faqSchema,
          }),
        });

        const payload = (await response.json()) as SaveResponse;
        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? t("generated.saveFailed"));
        }

        if (payload.data?.page) {
          setPages((current) =>
            current.map((page) => (page.id === payload.data?.page.id ? payload.data.page : page)),
          );
        }

        setMessage(t("generated.saved"));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : t("generated.saveFailed"));
      }
    });
  }

  if (!selectedPage || !analysis) {
    return (
      <EmptyState
        icon={Eye}
        title={t("generated.noPages")}
        description={t("generated.noPagesDescription")}
      />
    );
  }

  const titleTone = toneForLength(selectedPage.metaTitle.length, 30, 60, 20, 70);
  const metaTone = toneForLength(selectedPage.metaDescription.length, 120, 160, 90, 180);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">{t("generated.generatedPage")}</span>
              <select
                className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={selectedPageId}
                onChange={(event) => {
                  setSelectedPageId(event.target.value);
                  setMessage(dataset.error ?? null);
                }}
              >
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.keyword} - /{page.slug}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-3">
              {dataset.source !== "supabase" ? (
                <Badge variant="warning">{t("websites.previewMode")}</Badge>
              ) : null}
              <Badge variant="outline">{t(statusLabels[selectedPage.status])}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              disabled
              title={t("generated.optimizeSoonTitle")}
            >
              <WandSparkles className="size-4" />
              {t("generated.optimizeWithAi")}
            </Button>
            <Button onClick={savePage} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("generated.saveEdits")}
            </Button>
          </div>
        </div>
        {message && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-5">
              <p className="text-sm font-semibold">{t("generated.googlePreview")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("generated.googlePreviewDescription")}
              </p>
            </div>
            <div className="rounded-2xl border bg-background/50 p-5">
              <p className="text-sm text-success">{website?.url.replace(/\/$/, "")}/{selectedPage.slug}</p>
              <p className="mt-1 text-xl text-[#8ab4f8]">{selectedPage.metaTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedPage.metaDescription}</p>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold">{t("generated.seoPublishing")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("generated.workflowDescription")}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-7">
              {workflowSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-2 rounded-xl border bg-secondary/20 p-3 text-xs">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {index + 1}
                  </span>
                  <span>{t(step)}</span>
                </div>
              ))}
            </div>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">{t("generated.status")}</span>
              <select
                className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={selectedPage.status}
                onChange={(event) =>
                  updateSelectedPage((page) => ({
                    ...page,
                    status: event.target.value as GeneratedPageStatus,
                  }))
                }
              >
                <option value="draft">{t("content.statusDraft")}</option>
                <option value="review">{t("content.statusReview")}</option>
                <option value="approved">{t("generated.statusApproved")}</option>
                <option value="published">{t("content.statusPublished")}</option>
              </select>
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">SEO Title</span>
                <Input
                  value={selectedPage.metaTitle}
                  onChange={(event) =>
                    updateSelectedPage((page) => ({ ...page, metaTitle: event.target.value }))
                  }
                />
                <p className={cn("text-xs", titleTone === "success" ? "text-success" : titleTone === "warning" ? "text-warning" : "text-destructive")}>
                  {selectedPage.metaTitle.length} / 60 {t("generated.characters")}. {titleFeedback(selectedPage.metaTitle.length, t)}
                </p>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">Slug</span>
                <Input
                  value={selectedPage.slug}
                  onChange={(event) =>
                    updateSelectedPage((page) => ({ ...page, slug: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">{t("generated.canonical")}: /{selectedPage.slug}</p>
              </label>
            </div>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Meta Description</span>
              <textarea
                className="min-h-24 w-full rounded-lg border bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={selectedPage.metaDescription}
                onChange={(event) =>
                  updateSelectedPage((page) => ({ ...page, metaDescription: event.target.value }))
                }
              />
              <p className={cn("text-xs", metaTone === "success" ? "text-success" : metaTone === "warning" ? "text-warning" : "text-destructive")}>
                {selectedPage.metaDescription.length} / 160 {t("generated.characters")}. {metaFeedback(selectedPage.metaDescription.length, t)}
              </p>
            </label>
          </Card>

          <Card className="space-y-4 p-5">
            <p className="text-sm font-semibold">{t("generated.editableContent")}</p>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">H1</span>
              <Input
                value={selectedPage.content.h1}
                onChange={(event) =>
                  updateContent((content) => ({ ...content, h1: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">{t("generated.introduction")}</span>
              <textarea
                className="min-h-28 w-full rounded-lg border bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={selectedPage.content.introduction}
                onChange={(event) =>
                  updateContent((content) => ({ ...content, introduction: event.target.value }))
                }
              />
            </label>
            {selectedPage.content.sections.map((section, sectionIndex) => (
              <div key={`${section.h2}-${sectionIndex}`} className="space-y-3 rounded-xl border bg-secondary/20 p-4">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">H2</span>
                  <Input
                    value={section.h2}
                    onChange={(event) =>
                      updateContent((content) => ({
                        ...content,
                        sections: updateSection(content.sections, sectionIndex, (current) => ({
                          ...current,
                          h2: event.target.value,
                        })),
                      }))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">{t("generated.h3Comma")}</span>
                  <Input
                    value={section.h3.join(", ")}
                    onChange={(event) =>
                      updateContent((content) => ({
                        ...content,
                        sections: updateSection(content.sections, sectionIndex, (current) => ({
                          ...current,
                          h3: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                        })),
                      }))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">{t("generated.sectionText")}</span>
                  <textarea
                    className="min-h-24 w-full rounded-lg border bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={[section.intro, ...section.paragraphs].join("\n\n")}
                    onChange={(event) => {
                      const [intro = "", ...paragraphs] = event.target.value.split(/\n\s*\n/);
                      updateContent((content) => ({
                        ...content,
                        sections: updateSection(content.sections, sectionIndex, (current) => ({
                          ...current,
                          intro,
                          paragraphs: paragraphs.length ? paragraphs : [intro],
                        })),
                      }));
                    }}
                  />
                </label>
              </div>
            ))}
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">CTA</span>
              <Input
                value={selectedPage.content.cta}
                onChange={(event) =>
                  updateContent((content) => ({ ...content, cta: event.target.value }))
                }
              />
            </label>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{t("generated.faqOptimizer")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("generated.faqDescription")}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={regenerateFaq}>
                  <Sparkles className="size-3.5" />
                  {t("generated.regenerateFaq")}
                </Button>
              </div>
              <div className="mt-4 space-y-4">
                {selectedPage.content.faq.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="rounded-xl border bg-secondary/20 p-3">
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{t("generated.internalLinking")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("generated.internalLinkingDescription")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={insertInternalLinks}>
                  <Link2 className="size-3.5" />
                  {t("generated.insertAutomatically")}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {selectedPage.content.internalLinks.map((link) => (
                  <div key={`${link.anchorText}-${link.targetSuggestion}`} className="rounded-xl border bg-secondary/20 p-3">
                    <p className="text-sm font-medium">{link.anchorText}</p>
                    <p className="mt-1 text-xs text-primary">{link.targetSuggestion}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{link.reason}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="mb-6 rounded-xl border bg-secondary/30 p-4">
              <p className="text-xs text-muted-foreground">{t("generated.previewUrl")}</p>
              <p className="mt-1 text-sm font-medium">
                {website?.url.replace(/\/$/, "")}/{selectedPage.slug}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{t("content.keyword")}: {selectedPage.keyword}</p>
            </div>
            <article className="prose prose-invert max-w-none">
              <p className="text-xs uppercase tracking-[0.3em] text-primary">{t("generated.fullPreview")}</p>
              <h1 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold">
                {selectedPage.content.h1}
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {selectedPage.content.introduction}
              </p>
              {selectedPage.content.sections.map((section, sectionIndex) => (
                <section key={`${section.h2}-preview-${sectionIndex}`} className="mt-8">
                  <h2 className="font-[var(--font-manrope)] text-2xl font-bold">{section.h2}</h2>
                  <p className="mt-3 leading-7 text-muted-foreground">{section.intro}</p>
                  {section.h3.map((heading) => (
                    <h3 key={heading} className="mt-5 text-lg font-semibold">{heading}</h3>
                  ))}
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-3 leading-7 text-muted-foreground">{paragraph}</p>
                  ))}
                </section>
              ))}
              <section className="mt-8 rounded-2xl border border-primary/20 bg-primary/10 p-5">
                <h2 className="text-xl font-bold">{t("generated.faqHeading")}</h2>
                <div className="mt-4 space-y-4">
                  {selectedPage.content.faq.map((item) => (
                    <div key={item.question}>
                      <h3 className="font-semibold">{item.question}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
              <div className="mt-8 rounded-2xl bg-primary p-5 text-primary-foreground">
                <p className="text-lg font-bold">{selectedPage.content.cta}</p>
              </div>
            </article>
          </Card>
        </div>

        <aside className="space-y-5 2xl:sticky 2xl:top-6 2xl:self-start">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{t("generated.seoScoreLive")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("generated.seoScoreDescription")}</p>
              </div>
              <p className={cn("text-4xl font-bold", scoreColor(analysis.score))}>{analysis.score}</p>
            </div>
            <Progress value={analysis.score} className="mt-4" indicatorClassName={indicatorClass(analysis.score)} />
            <div className="mt-5 grid gap-2">
              {analysis.checks.map((check) => (
                <div key={check.label} className="flex items-start justify-between gap-3 rounded-xl border bg-secondary/20 p-3">
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                  {check.passed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-warning" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold">{t("generated.keywordDensityTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("generated.mainKeyword")}: {selectedPage.keyword}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={t("generated.occurrences")} value={analysis.keywordCount.toString()} />
              <Metric label={t("generated.density")} value={`${analysis.density.toFixed(2)}%`} />
              <Metric label="H2" value={analysis.h2KeywordCount.toString()} />
              <Metric label={t("generated.paragraphs")} value={analysis.paragraphKeywordCount.toString()} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {analysis.density < 0.6
                ? t("generated.keywordTooLow")
                : analysis.density > 2.5
                  ? t("generated.keywordTooHigh")
                  : t("generated.keywordBalanced")}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold">{t("generated.readabilityScore")}</p>
            <div className="mt-4 flex items-center justify-between">
              <Progress value={analysis.readabilityScore} className="max-w-[240px]" indicatorClassName={indicatorClass(analysis.readabilityScore)} />
              <span className={cn("text-2xl font-bold", scoreColor(analysis.readabilityScore))}>
                {analysis.readabilityScore}
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>{t("generated.averageSentenceLength")}: {analysis.averageSentenceLength.toFixed(1)} {t("generated.words")}.</li>
              <li>{t("generated.longParagraphs")}: {analysis.longParagraphs}.</li>
              <li>{t("generated.passiveSignals")}: {analysis.passiveCount}.</li>
              <li>{t("generated.repetitions")}: {analysis.repeatedWords}.</li>
            </ul>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold">{t("generated.eeatAnalyzer")}</p>
            <div className="mt-4 flex items-center justify-between">
              <Progress value={analysis.eeatScore} className="max-w-[240px]" indicatorClassName={indicatorClass(analysis.eeatScore)} />
              <span className={cn("text-2xl font-bold", scoreColor(analysis.eeatScore))}>{analysis.eeatScore}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("generated.eeatDescription")}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              <p className="text-sm font-semibold">{t("generated.imageSeo")}</p>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>{t("generated.detectedImages")}: {analysis.imageCount}</p>
              <p>{t("generated.altText")}: {t("generated.altPrepared")}</p>
              <p>{t("generated.recommendedFilename")}: {selectedPage.slug}.webp</p>
              <p>{t("generated.recommendedDimensions")}: 1200x800, WebP compression.</p>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-primary" />
              <p className="text-sm font-semibold">FAQ schema.org</p>
            </div>
            <pre className="mt-4 max-h-72 overflow-auto rounded-xl border bg-background/60 p-4 text-xs text-muted-foreground">
              {faqSchemaText}
            </pre>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold">{t("generated.publishing")}</p>
            <div className="mt-4 space-y-3">
              {[
                [t("generated.submitSitemap"), t("generated.sitemapDetail")],
                [t("generated.requestIndexing"), t("generated.indexingDetail")],
                [t("generated.monitorPosition"), t("generated.monitorDetail")],
              ].map(([title, detail]) => (
                <div key={title} className="flex gap-3 rounded-xl border bg-secondary/20 p-3">
                  <Rocket className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
