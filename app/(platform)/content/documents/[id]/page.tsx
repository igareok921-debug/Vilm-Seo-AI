import { ArrowLeft, CalendarDays, FileText } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerTranslator } from "@/lib/i18n/server";
import { getAiDocumentById } from "@/lib/supabase/ai-documents";
import { getWebsites } from "@/lib/supabase/websites";
import type { AiDocumentType } from "@/types";

export const dynamic = "force-dynamic";

const typeLabelKeys: Record<AiDocumentType, "content.seoArticle" | "content.landingPage" | "content.metaTags" | "content.faq" | "content.textOptimization" | "content.contentIdeas"> = {
  seo_article: "content.seoArticle",
  landing_page: "content.landingPage",
  meta_tags: "content.metaTags",
  faq: "content.faq",
  text_optimization: "content.textOptimization",
  content_ideas: "content.contentIdeas",
};

const statusLabels = {
  draft: "content.statusDraft",
  review: "content.statusReview",
  published: "content.statusPublished",
} as const;

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMarkdown(content: unknown) {
  if (content && typeof content === "object" && "markdown" in content) {
    const markdown = (content as { markdown?: unknown }).markdown;
    return typeof markdown === "string" ? markdown : "";
  }

  return "";
}

export default async function AiDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getServerTranslator();
  const [document, websitesDataset] = await Promise.all([
    getAiDocumentById(id),
    getWebsites(),
  ]);

  if (!document) {
    return (
      <EmptyState
        icon={FileText}
        title={t("document.notFound")}
        description={t("document.notFoundDescription")}
        action={t("document.backToContent")}
        actionHref="/content"
      />
    );
  }

  const website = websitesDataset.websites.find((item) => item.id === document.websiteId);
  if (!website) {
    return (
      <EmptyState
        icon={FileText}
        title={t("document.noAccess")}
        description={t("document.noAccessDescription")}
        action={t("document.backToContent")}
        actionHref="/content"
      />
    );
  }

  const markdown = getMarkdown(document.content);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("document.eyebrow")}
        title={document.title}
        description={t("document.description")}
        actions={
          <Button asChild variant="outline">
            <Link href={`/content?websiteId=${encodeURIComponent(document.websiteId)}`}>
              <ArrowLeft className="size-4" />
              {t("document.back")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("content.website")}</p>
          <p className="mt-2 font-semibold">{website?.name ?? t("document.unknownWebsite")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("content.type")}</p>
          <p className="mt-2 font-semibold">{t(typeLabelKeys[document.type])}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("content.keyword")}</p>
          <p className="mt-2 font-semibold">{document.keyword ?? "N/A"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t("content.status")}</p>
          <Badge className="mt-2" variant={document.status === "published" ? "success" : "outline"}>
            {t(statusLabels[document.status])}
          </Badge>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-sm font-semibold">{t("document.generatedContent")}</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {t("document.generatedAt")}: {formatDateTime(document.createdAt, locale)}
            </p>
          </div>
          <Badge variant="default">{document.tone}</Badge>
        </div>

        {markdown ? (
          <article className="mt-5 whitespace-pre-wrap rounded-xl border bg-background/40 p-5 text-sm leading-7 text-foreground">
            {markdown}
          </article>
        ) : (
          <EmptyState
            icon={FileText}
            title={t("document.emptyContent")}
            description={t("document.emptyContentDescription")}
          />
        )}
      </Card>
    </div>
  );
}
