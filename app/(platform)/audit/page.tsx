import { AuditPageClient } from "@/components/audit-page-client";
import { getLatestAuditData } from "@/lib/supabase/audit-data";
import { getWebsites } from "@/lib/supabase/websites";

export const metadata = { title: "Audit SEO" };
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ websiteId?: string }>;
}) {
  const params = await searchParams;
  const { websites } = await getWebsites();
  const selectedWebsiteId = params?.websiteId ?? websites[0]?.id;
  const data = await getLatestAuditData(selectedWebsiteId);

  return <AuditPageClient data={data} websiteId={selectedWebsiteId} />;
}
