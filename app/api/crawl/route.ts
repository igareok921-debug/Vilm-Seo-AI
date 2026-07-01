import { after, NextResponse } from "next/server";
import { assertSafePublicUrl, runCrawlJob } from "@/lib/crawler";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
} from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";

export const maxDuration = 300;

interface CrawlBody {
  websiteId?: unknown;
  url?: unknown;
}

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured for server-side operations." },
      { status: 503 },
    );
  }

  const crawlId = new URL(request.url).searchParams.get("id");
  if (!crawlId) {
    return NextResponse.json({ error: "The id parameter is required." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("crawls")
      .select(
        "id, website_id, status, start_url, pages_discovered, pages_crawled, issues_found, progress, error_message",
      )
      .eq("id", crawlId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "The crawl does not exist." }, { status: 404 });
    }

    await getOwnedWebsiteForCurrentUser(data.website_id);

    return NextResponse.json({
      data: {
        id: data.id,
        websiteId: data.website_id,
        status: data.status,
        startUrl: data.start_url,
        pagesDiscovered: data.pages_discovered,
        pagesCrawled: data.pages_crawled,
        issuesFound: data.issues_found,
        progress: data.progress,
        errorMessage: data.error_message,
      },
    });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[api/crawl] Crawl progress could not be read:", error);
    return NextResponse.json({ error: "Progress could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "The crawler requires secure server configuration before it can run.",
      },
      { status: 503 },
    );
  }

  let body: CrawlBody;
  try {
    body = (await request.json()) as CrawlBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!websiteId || !rawUrl) {
    return NextResponse.json(
      { error: "websiteId and url are required." },
      { status: 422 },
    );
  }

  try {
    const urlWithProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const safeUrl = await assertSafePublicUrl(urlWithProtocol);
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    const { supabase, website, organizationId, workspace } = access;

    if (new URL(website.url).origin !== new URL(safeUrl).origin) {
      return NextResponse.json(
        { error: "The URL must belong to the selected website." },
        { status: 422 },
      );
    }

    await checkUsageLimit({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "crawl.started",
    });

    const { data: crawl, error: crawlError } = await supabase
      .from("crawls")
      .insert({
        website_id: websiteId,
        start_url: safeUrl,
        status: "pending",
        pages_discovered: 1,
      })
      .select("id")
      .single();

    if (crawlError) throw crawlError;

    await recordUsageEvent({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "crawl.started",
      metadata: { crawl_id: crawl.id, start_url: safeUrl },
    });

    after(async () => {
      await runCrawlJob(crawl.id, { websiteId, url: safeUrl });
    });

    return NextResponse.json(
      { data: { crawlId: crawl.id, status: "pending" } },
      { status: 202 },
    );
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    const usageError = getUsageLimitErrorResponse(error);
    if (usageError) return usageError;
    const message = error instanceof Error ? error.message : "The crawler could not be started.";
    logSupabaseError("[api/crawl] Crawl start failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
