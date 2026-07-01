"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  Bot,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ContentPlanWorkspace } from "@/components/content-plan-workspace";
import { useActiveWebsite } from "@/components/active-website-provider";
import { EmptyState } from "@/components/empty-state";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AiDocument,
  AiDocumentsDataset,
  AiDocumentTone,
  AiDocumentType,
  ContentPlanDataset,
  ContentPlanItem,
  Website,
} from "@/types";

const documentTypes: Array<{ value: AiDocumentType; labelKey: "content.seoArticle" | "content.landingPage" | "content.metaTags" | "content.faq" | "content.textOptimization" | "content.contentIdeas" }> = [
  { value: "seo_article", labelKey: "content.seoArticle" },
  { value: "landing_page", labelKey: "content.landingPage" },
  { value: "meta_tags", labelKey: "content.metaTags" },
  { value: "faq", labelKey: "content.faq" },
  { value: "text_optimization", labelKey: "content.textOptimization" },
  { value: "content_ideas", labelKey: "content.contentIdeas" },
];

const toneOptions: AiDocumentTone[] = ["profesional", "prietenos", "premium", "comercial"];

const typeLabelKeys = Object.fromEntries(documentTypes.map((type) => [type.value, type.labelKey])) as Record<AiDocumentType, (typeof documentTypes)[number]["labelKey"]>;

const statusLabels = {
  draft: "content.statusDraft",
  review: "content.statusReview",
  published: "content.statusPublished",
} as const;

const toneLabels: Record<AiDocumentTone, string> = {
  profesional: "Professional",
  prietenos: "Friendly",
  premium: "Premium",
  comercial: "Commercial",
};

const tools: Array<{
  icon: typeof FileText;
  titleKey: "content.seoArticle" | "content.contentIdeas" | "content.textOptimization";
  descriptionKey: "content.seoArticleDescription" | "content.contentIdeasDescription" | "content.textOptimizationDescription";
  badgeKey?: "content.popular";
  type: AiDocumentType;
}> = [
  {
    icon: FileText,
    titleKey: "content.seoArticle",
    descriptionKey: "content.seoArticleDescription",
    badgeKey: "content.popular",
    type: "seo_article" as AiDocumentType,
  },
  {
    icon: Lightbulb,
    titleKey: "content.contentIdeas",
    descriptionKey: "content.contentIdeasDescription",
    type: "content_ideas" as AiDocumentType,
  },
  {
    icon: WandSparkles,
    titleKey: "content.textOptimization",
    descriptionKey: "content.textOptimizationDescription",
    type: "text_optimization" as AiDocumentType,
  },
];

interface DocumentFormState {
  websiteId: string;
  type: AiDocumentType;
  keyword: string;
  title: string;
  language: string;
  tone: AiDocumentTone;
  instructions: string;
}

interface CreateDocumentResponse {
  error?: string;
  data?: {
    document: AiDocument;
  };
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ContentAiWorkspace({
  websites,
  planDatasets,
  documentsDataset,
}: {
  websites: Website[];
  planDatasets: Record<string, ContentPlanDataset>;
  documentsDataset: AiDocumentsDataset;
}) {
  const { locale, t } = useI18n();
  const { activeWebsiteId } = useActiveWebsite();
  const initialWebsiteId =
    activeWebsiteId && websites.some((website) => website.id === activeWebsiteId)
      ? activeWebsiteId
      : websites[0]?.id ?? "";
  const [documents, setDocuments] = useState(documentsDataset.documents);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(documentsDataset.error ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<DocumentFormState>({
    websiteId: initialWebsiteId,
    type: "seo_article",
    keyword: "",
    title: "",
    language: "en",
    tone: "profesional",
    instructions: "",
  });

  const websiteLookup = useMemo(
    () => new Map(websites.map((website) => [website.id, website])),
    [websites],
  );

  function openDocumentModal(type: AiDocumentType = "seo_article", seed?: Partial<DocumentFormState>) {
    setForm((current) => ({
      ...current,
      websiteId: seed?.websiteId ?? activeWebsiteId ?? current.websiteId ?? websites[0]?.id ?? "",
      type,
      keyword: seed?.keyword ?? "",
      title: seed?.title ?? "",
      language: seed?.language ?? "en",
      tone: seed?.tone ?? "profesional",
      instructions: seed?.instructions ?? "",
    }));
    setMessage(null);
    setOpen(true);
  }

  async function createDocument(input = form) {
    setIsCreating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/content/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as CreateDocumentResponse;
      if (!response.ok || !payload.data?.document) {
        throw new Error(payload.error ?? t("content.createFailed"));
      }

      setDocuments((current) => [payload.data!.document, ...current.filter((document) => document.id !== payload.data!.document.id)]);
      setMessage(`${t("content.created")}: ${payload.data.document.title}`);
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("content.createFailed"));
    } finally {
      setIsCreating(false);
    }
  }

  function createFromPlan(plan: ContentPlanItem, websiteId: string) {
    void createDocument({
      websiteId,
      type: plan.contentType === "landing page" ? "landing_page" : "seo_article",
      keyword: plan.targetKeyword,
      title: plan.title,
      language: "en",
      tone: "profesional",
      instructions: `Generate the document based on this editorial plan:\n${plan.outline.join("\n")}`,
    });
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("content.eyebrow")}
        title={t("content.title")}
        description={t("content.description")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/content/generated"><FileText className="size-4" />{t("content.generatedPages")}</Link>
            </Button>
            <Button onClick={() => openDocumentModal()}>
              <Plus className="size-4" />
              {t("content.newDocument")}
            </Button>
          </>
        }
      />

      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/15 via-card to-card p-6 sm:p-8">
        <div className="absolute -right-14 -top-20 size-60 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative max-w-2xl">
          <Badge><Sparkles className="mr-1 size-3" />{t("content.active")}</Badge>
          <h3 className="mt-5 font-[var(--font-manrope)] text-2xl font-bold">{t("content.heroTitle")}</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("content.heroDescription")}</p>
          <Button className="mt-6" variant="outline" asChild>
            <a href="#functii-content-ai">{t("content.viewFeatures")} <ArrowRight className="size-4" /></a>
          </Button>
        </div>
      </Card>

      {message ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {message}
        </div>
      ) : null}

      <div id="functii-content-ai" className="grid gap-4 md:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.type} className="group p-5 transition hover:border-primary/30">
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <tool.icon className="size-5" />
              </span>
              {"badgeKey" in tool && tool.badgeKey ? <Badge>{t(tool.badgeKey)}</Badge> : null}
            </div>
            <h3 className="mt-5 font-semibold">{t(tool.titleKey)}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(tool.descriptionKey)}</p>
            <Button variant="ghost" size="sm" className="mt-4 px-0 text-primary" onClick={() => openDocumentModal(tool.type)}>
              {t("content.open")} <ArrowRight className="size-3.5" />
            </Button>
          </Card>
        ))}
      </div>

      <ContentPlanWorkspace
        websites={websites}
        datasets={planDatasets}
        onGenerateDocument={createFromPlan}
      />

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold">{t("content.recentDocuments")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("content.recentDocumentsDescription")}</p>
        </div>
        {documents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={t("content.noDocuments")}
            description={t("content.noDocumentsDescription")}
            action={t("content.createFirstDocument")}
            onAction={() => openDocumentModal()}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {documents.slice(0, 8).map((document) => {
              const website = websiteLookup.get(document.websiteId);
              return (
                <Card key={document.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{website?.name ?? "Website"} · {formatDateTime(document.createdAt, locale)}</p>
                      <h3 className="mt-2 font-semibold">{document.title}</h3>
                    </div>
                    <Badge variant={document.status === "published" ? "success" : "outline"}>
                      {t(statusLabels[document.status])}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("content.type")}</p>
                      <p className="mt-1 font-medium">{t(typeLabelKeys[document.type])}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("content.keyword")}</p>
                      <p className="mt-1 font-medium">{document.keyword ?? "N/A"}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href={`/content/documents/${encodeURIComponent(document.id)}`}>
                      <ExternalLink className="size-3.5" />
                      {t("content.openDocument")}
                    </Link>
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold">{t("content.createModalTitle")}</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                  {t("content.createModalDescription")}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" disabled={isCreating}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("content.website")}</span>
                <select className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={form.websiteId} onChange={(event) => setForm((current) => ({ ...current, websiteId: event.target.value }))}>
                  {websites.map((website) => <option key={website.id} value={website.id}>{website.name}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("content.documentType")}</span>
                <select className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AiDocumentType }))}>
                  {documentTypes.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("content.targetKeyword")}</span>
                <Input value={form.keyword} onChange={(event) => setForm((current) => ({ ...current, keyword: event.target.value }))} placeholder={t("content.keywordPlaceholder")} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("content.titleSubject")}</span>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={t("content.titlePlaceholder")} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("content.language")}</span>
                <Input value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))} placeholder="ro" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">{t("content.tone")}</span>
                <select className="h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={form.tone} onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value as AiDocumentTone }))}>
                  {toneOptions.map((tone) => <option key={tone} value={tone}>{toneLabels[tone]}</option>)}
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-2 text-sm">
              <span className="text-muted-foreground">{t("content.instructions")}</span>
              <textarea
                className="min-h-28 w-full rounded-lg border bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={form.instructions}
                onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
                placeholder={t("content.instructionsPlaceholder")}
              />
            </label>

            <div className="mt-6 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={isCreating}>{t("content.cancel")}</Button>
              </Dialog.Close>
              <Button onClick={() => createDocument()} disabled={isCreating || !form.websiteId || !form.title}>
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {t("content.createDocument")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
