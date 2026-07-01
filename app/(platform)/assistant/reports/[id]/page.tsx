import { ArrowLeft, CalendarDays, FileText } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerTranslator } from "@/lib/i18n/server";
import { getAssistantReportById } from "@/lib/supabase/assistant-reports";
import { getWebsites } from "@/lib/supabase/websites";

export const dynamic = "force-dynamic";

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AssistantReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getServerTranslator();
  const [report, websitesDataset] = await Promise.all([
    getAssistantReportById(id),
    getWebsites(),
  ]);

  if (!report) {
    return (
      <EmptyState
        icon={FileText}
        title={t("assistantReport.notFound")}
        description={t("assistantReport.notFoundDescription")}
        action={t("assistantReport.back")}
        actionHref="/assistant"
      />
    );
  }

  const website = websitesDataset.websites.find((item) => item.id === report.websiteId);
  if (!website) {
    return (
      <EmptyState
        icon={FileText}
        title={t("assistantReport.noAccess")}
        description={t("assistantReport.noAccessDescription")}
        action={t("assistantReport.back")}
        actionHref="/assistant"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("assistantReport.eyebrow")}
        title={report.title}
        description={report.summary || t("assistantReport.defaultDescription")}
        actions={
          <Button asChild variant="outline">
            <Link href={`/assistant?websiteId=${encodeURIComponent(report.websiteId)}`}>
              <ArrowLeft className="size-4" />
              {t("assistantReport.back")}
            </Link>
          </Button>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-sm font-semibold">{website?.name ?? "Website"}</p>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {t("assistantReport.generatedAt")}: {formatDateTime(report.createdAt, locale)}
            </p>
          </div>
          <Badge variant="default">{report.type}</Badge>
        </div>
        <article className="mt-5 whitespace-pre-wrap rounded-xl border bg-background/40 p-5 text-sm leading-7">
          {report.report}
        </article>
      </Card>
    </div>
  );
}
