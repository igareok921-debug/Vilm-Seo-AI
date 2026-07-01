import { CrawlPageClient } from "@/components/crawl-page-client";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { getCrawlOverview, getRecentCrawls } from "@/lib/supabase/crawl-data";
import { getWebsites } from "@/lib/supabase/websites";

export const metadata = { title: "Crawl" };

export const dynamic = "force-dynamic";

export default async function CrawlPage({
  searchParams,
}: {
  searchParams: Promise<{ websiteId?: string }>;
}) {
  const { websiteId } = await searchParams;
  const { websites } = await getWebsites();
  const selectedWebsiteId = websiteId ?? websites[0]?.id;
  const [recentCrawls, crawlOverview] = await Promise.all([
    getRecentCrawls(selectedWebsiteId),
    getCrawlOverview(selectedWebsiteId),
  ]);

  return (
    <CrawlPageClient
      websites={websites}
      configured={isSupabaseAdminConfigured()}
      selectedWebsiteId={selectedWebsiteId}
      initialRecentCrawls={recentCrawls}
      initialOverview={crawlOverview}
    />
  );
}
