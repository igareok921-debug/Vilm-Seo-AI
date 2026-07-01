import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createGoogleAuthorizationUrl,
} from "@/lib/google/search-console";
import { isGoogleSearchConsoleConfigured } from "@/lib/google/config";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";

export async function GET(request: NextRequest) {
  const websiteId = request.nextUrl.searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  if (!isGoogleSearchConsoleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured in .env.local." },
      { status: 503 },
    );
  }

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    console.error("[search-console/connect] Website verification failed:", error);
    return NextResponse.json({ error: "The website does not exist or does not belong to your account." }, { status: 404 });
  }

  const state = randomBytes(32).toString("hex");
  const response = NextResponse.redirect(createGoogleAuthorizationUrl(state));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  response.cookies.set("gsc_oauth_state", state, cookieOptions);
  response.cookies.set("gsc_website_id", websiteId, cookieOptions);
  return response;
}
