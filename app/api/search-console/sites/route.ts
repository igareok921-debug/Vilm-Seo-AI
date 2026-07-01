import { NextResponse } from "next/server";
import { getSearchConsoleSites } from "@/lib/google/search-console";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
} from "@/lib/supabase/website-access";

export async function GET(request: Request) {
  const websiteId = new URL(request.url).searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
    return NextResponse.json({ data: await getSearchConsoleSites(websiteId) });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[api/search-console/sites] Error:", error);
    return NextResponse.json(
      { error: "Search Console properties could not be loaded." },
      { status: 500 },
    );
  }
}
