import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { getReportsDataset } from "@/lib/supabase/reports";
import { getWebsites } from "@/lib/supabase/websites";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ websiteId?: string }>;
}) {
  const params = await searchParams;
  const { websites } = await getWebsites();
  const selectedWebsite = websites.find((website) => website.id === params?.websiteId) ?? websites[0];
  const reportsDataset = await getReportsDataset(selectedWebsite?.id ?? "");

  return (
    <ReportsWorkspace
      websites={websites}
      initialWebsiteId={selectedWebsite?.id ?? ""}
      initialReports={reportsDataset.reports}
      initialError={reportsDataset.error}
    />
  );
}
