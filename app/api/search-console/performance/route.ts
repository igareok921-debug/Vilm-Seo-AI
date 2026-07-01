import { NextResponse } from "next/server";
import { getSearchConsoleDashboard } from "@/lib/google/search-console";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";

export async function GET(request: Request) {
  const websiteId = new URL(request.url).searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
    const data = await getSearchConsoleDashboard(websiteId);
    return NextResponse.json({
      data: {
        connected: data.connected,
        source: data.source,
        property: data.property,
        period: data.period,
        metrics: data.metrics,
        decliningPages: data.decliningPages,
        opportunities: data.opportunities,
      },
      warning: data.error,
    });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    console.error("[api/search-console/performance] Error:", error);
    return NextResponse.json({ error: "Search Console data could not be loaded." }, { status: 500 });
  }
}
