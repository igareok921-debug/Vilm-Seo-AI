import { Download } from "lucide-react";
import { Suspense } from "react";
import { KeywordResearchWorkspace } from "@/components/keyword-research-workspace";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";
import { getKeywordResearchDataset } from "@/lib/supabase/keyword-research";
import { getWebsites } from "@/lib/supabase/websites";
import type { KeywordResearchDataset } from "@/types";

export const metadata = { title: "Keywords" };
export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  const { t } = await getServerTranslator();
  const { websites } = await getWebsites();
  const datasets = Object.fromEntries(
    await Promise.all(
      websites.map(async (website) => [
        website.id,
        await getKeywordResearchDataset(website),
      ] as [string, KeywordResearchDataset]),
    ),
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("keywords.eyebrow")}
        title={t("keywords.title")}
        description={t("keywords.description")}
        actions={
          <Button variant="outline" disabled title={t("common.comingSoon")}>
            <Download className="size-4" />
            {t("keywords.exportSoon")}
          </Button>
        }
      />
      <Suspense>
        <KeywordResearchWorkspace websites={websites} datasets={datasets} />
      </Suspense>
    </div>
  );
}
