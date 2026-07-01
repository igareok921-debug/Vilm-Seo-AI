import { NextResponse } from "next/server";
import { getSearchConsoleRows } from "@/lib/google/search-console";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";

export async function GET(request: Request) {
  const websiteId = new URL(request.url).searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
    return NextResponse.json({
      data: await getSearchConsoleRows(websiteId, "query"),
    });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    console.error("[api/search-console/queries] Error:", error);
    return NextResponse.json({ error: "Search Console queries could not be loaded." }, { status: 500 });
  }
}
