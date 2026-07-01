import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  findMatchingProperty,
  listGoogleSitesWithTokens,
} from "@/lib/google/search-console";
import { googleConfig } from "@/lib/google/config";
import { encryptToken } from "@/lib/google/token-crypto";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
} from "@/lib/supabase/website-access";

function redirectToWebsite(websiteId: string | null, status: string) {
  const target = websiteId
    ? `${googleConfig.appUrl}/websites/${websiteId}/search-console?google=${status}`
    : `${googleConfig.appUrl}/websites?google=${status}`;
  const response = NextResponse.redirect(target);
  response.cookies.delete("gsc_oauth_state");
  response.cookies.delete("gsc_website_id");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const expectedState = request.cookies.get("gsc_oauth_state")?.value;
  const websiteId = request.cookies.get("gsc_website_id")?.value ?? null;

  if (oauthError) return redirectToWebsite(websiteId, "denied");
  if (!code || !state || !expectedState || state !== expectedState || !websiteId) {
    return redirectToWebsite(websiteId, "invalid_state");
  }

  try {
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    const { supabase, website } = access;

    const tokens = await exchangeGoogleCode(code);
    const workspace = await getCurrentWorkspace();
    const sites = await listGoogleSitesWithTokens(tokens);
    const property = findMatchingProperty(
      sites.map((site) => site.siteUrl),
      website.url,
    );

    const { data: existing } = await supabase
      .from("integrations")
      .select("refresh_token_encrypted")
      .eq("website_id", websiteId)
      .eq("provider", "google_search_console")
      .maybeSingle();

    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : existing?.refresh_token_encrypted;
    if (!refreshTokenEncrypted) {
      return redirectToWebsite(websiteId, "refresh_token_missing");
    }

    const { error: saveError } = await supabase.from("integrations").upsert(
      {
        website_id: websiteId,
        provider: "google_search_console",
        status: "active",
        access_token_encrypted: encryptToken(tokens.access_token!),
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        scopes: tokens.scope?.split(" ") ?? [],
        external_property_id: property,
        metadata: {
          sites,
          google_account_email: workspace?.profile.email ?? null,
        },
      },
      { onConflict: "website_id,provider" },
    );
    if (saveError) throw saveError;

    await supabase.from("activity_logs").insert({
      website_id: websiteId,
      action: "integration.google_search_console.connected",
      description: property
        ? `Google Search Console conectat: ${property}`
        : "Google Search Console is connected, but the website property was not found.",
      metadata: { property, sites_count: sites.length },
    });

    return redirectToWebsite(websiteId, property ? "connected" : "property_missing");
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return redirectToWebsite(websiteId, "forbidden");
    logSupabaseError("[search-console/callback] Conectarea Google failed:", error);
    return redirectToWebsite(websiteId, "error");
  }
}
