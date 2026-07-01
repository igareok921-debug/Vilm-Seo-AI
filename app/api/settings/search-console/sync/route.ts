import { NextResponse } from "next/server";
import { getSearchConsoleDashboard } from "@/lib/google/search-console";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";

interface SyncBody {
  websiteId?: unknown;
}

export async function POST(request: Request) {
  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  try {
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    const { data: integration, error } = await access.supabase
      .from("integrations")
      .select("id")
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console")
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!integration) {
      return NextResponse.json({ error: "Google Search Console is not connected." }, { status: 409 });
    }

    await getSearchConsoleDashboard(websiteId);
    const lastSyncedAt = new Date().toISOString();

    return NextResponse.json({ data: { lastSyncedAt } });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    console.error("[settings/search-console] Sync failed:", error);
    return NextResponse.json({ error: "Search Console sync failed." }, { status: 500 });
  }
}
