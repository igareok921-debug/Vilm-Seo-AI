import { NextResponse } from "next/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";

interface DisconnectBody {
  websiteId?: unknown;
}

export async function DELETE(request: Request) {
  let body: DisconnectBody;
  try {
    body = (await request.json()) as DisconnectBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  try {
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    const { error } = await access.supabase
      .from("integrations")
      .delete()
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console");

    if (error) throw error;

    await access.supabase.from("activity_logs").insert({
      website_id: websiteId,
      action: "integration.google_search_console.disconnected",
      description: "Google Search Console was disconnected.",
      metadata: {},
    });

    return NextResponse.json({ data: { connected: false } });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    console.error("[settings/search-console] Disconnect failed:", error);
    return NextResponse.json({ error: "Google Search Console could not be disconnected." }, { status: 500 });
  }
}
