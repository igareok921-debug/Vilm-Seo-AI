import { ContentAiWorkspace } from "@/components/content-ai-workspace";
import { getAiDocumentsDataset } from "@/lib/supabase/ai-documents";
import { getContentPlanDataset } from "@/lib/supabase/keyword-research";
import { getWebsites } from "@/lib/supabase/websites";
import type { ContentPlanDataset } from "@/types";

export const metadata = { title: "AI Content" };
export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const { websites } = await getWebsites();
  const [planDatasets, documentsDataset] = await Promise.all([
    Promise.all(
      websites.map(async (website) => [
        website.id,
        await getContentPlanDataset(website),
      ] as [string, ContentPlanDataset]),
    ).then((entries) => Object.fromEntries(entries)),
    getAiDocumentsDataset(websites),
  ]);

  return (
    <ContentAiWorkspace
      websites={websites}
      planDatasets={planDatasets}
      documentsDataset={documentsDataset}
    />
  );
}
