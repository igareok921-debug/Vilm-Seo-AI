import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { GeneratedPageEditor } from "@/components/generated-page-editor";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";
import { getGeneratedPagesDataset } from "@/lib/supabase/generated-pages";
import { getWebsites } from "@/lib/supabase/websites";

export const metadata = { title: "Generated Pages" };
export const dynamic = "force-dynamic";

export default async function GeneratedContentPage() {
  const { t } = await getServerTranslator();
  const { websites } = await getWebsites();
  const dataset = await getGeneratedPagesDataset(websites);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("generated.eyebrow")}
        title={t("generated.title")}
        description={t("generated.description")}
        actions={
          <Button asChild variant="outline">
            <Link href="/keywords">
              <ArrowLeft className="size-4" />
              {t("generated.backToKeywords")}
            </Link>
          </Button>
        }
      />
      <Suspense>
        <GeneratedPageEditor websites={websites} dataset={dataset} />
      </Suspense>
    </div>
  );
}
