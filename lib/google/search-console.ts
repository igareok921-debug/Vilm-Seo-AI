import "server-only";

import { google, type searchconsole_v1 } from "googleapis";
import { googleConfig, SEARCH_CONSOLE_SCOPE } from "@/lib/google/config";
import { decryptToken, encryptToken } from "@/lib/google/token-crypto";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  SearchConsoleDashboardData,
  SearchConsoleMetricRow,
} from "@/types";

interface IntegrationRow {
  id: string;
  website_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  external_property_id: string | null;
  metadata: Record<string, unknown>;
}

function createOAuthClient() {
  if (!googleConfig.clientId || !googleConfig.clientSecret) {
    throw new Error("Credentialele Google OAuth nu sunt configurate.");
  }

  return new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    googleConfig.redirectUri,
  );
}

export function createGoogleAuthorizationUrl(state: string) {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: [SEARCH_CONSOLE_SCOPE],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google nu a returnat un access token.");
  }

  return tokens;
}

export function findMatchingProperty(siteUrls: string[], websiteUrl: string) {
  const website = new URL(websiteUrl);
  const hostname = website.hostname.replace(/^www\./, "").toLowerCase();

  return (
    siteUrls.find((siteUrl) => {
      if (siteUrl.startsWith("sc-domain:")) {
        return siteUrl.slice("sc-domain:".length).replace(/^www\./, "").toLowerCase() === hostname;
      }
      try {
        return new URL(siteUrl).hostname.replace(/^www\./, "").toLowerCase() === hostname;
      } catch {
        return false;
      }
    }) ?? null
  );
}

async function getIntegration(websiteId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("integrations")
    .select(
      "id, website_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, external_property_id, metadata",
    )
    .eq("website_id", websiteId)
    .eq("provider", "google_search_console")
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationRow | null;
}

async function getAuthorizedClient(websiteId: string) {
  const integration = await getIntegration(websiteId);
  if (!integration) return null;

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: decryptToken(integration.access_token_encrypted),
    refresh_token: integration.refresh_token_encrypted
      ? decryptToken(integration.refresh_token_encrypted)
      : undefined,
    expiry_date: integration.token_expires_at
      ? new Date(integration.token_expires_at).getTime()
      : undefined,
  });

  return { oauth2Client, integration };
}

async function persistRefreshedCredentials(
  integration: IntegrationRow,
  credentials: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  },
) {
  if (!credentials.access_token) return;

  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    access_token_encrypted: encryptToken(credentials.access_token),
    token_expires_at: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : null,
    status: "active",
  };
  if (credentials.refresh_token) {
    update.refresh_token_encrypted = encryptToken(credentials.refresh_token);
  }

  const { error } = await supabase.from("integrations").update(update).eq("id", integration.id);
  if (error) console.error("[search-console] Refreshed token could not be saved:", error);
}

export async function listGoogleSitesWithTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(tokens);
  const searchConsole = google.searchconsole({ version: "v1", auth: oauth2Client });
  const response = await searchConsole.sites.list();
  return (response.data.siteEntry ?? []).map((site) => ({
    siteUrl: site.siteUrl ?? "",
    permissionLevel: site.permissionLevel ?? "siteUnverifiedUser",
  }));
}

export async function getSearchConsoleSites(websiteId: string) {
  const authorized = await getAuthorizedClient(websiteId);
  if (!authorized) return { connected: false, sites: [] };

  const searchConsole = google.searchconsole({
    version: "v1",
    auth: authorized.oauth2Client,
  });
  const response = await searchConsole.sites.list();
  await persistRefreshedCredentials(authorized.integration, authorized.oauth2Client.credentials);

  return {
    connected: true,
    sites: (response.data.siteEntry ?? []).map((site) => ({
      siteUrl: site.siteUrl ?? "",
      permissionLevel: site.permissionLevel ?? "siteUnverifiedUser",
    })),
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriods() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - 27);

  return {
    current: { startDate: isoDate(start), endDate: isoDate(end) },
    previous: { startDate: isoDate(previousStart), endDate: isoDate(previousEnd) },
  };
}

function emptySearchConsoleData(error?: string): SearchConsoleDashboardData {
  const periods = getPeriods();
  return {
    source: "empty",
    connected: false,
    property: null,
    period: periods.current,
    metrics: {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    },
    topQueries: [],
    topPages: [],
    decliningPages: [],
    opportunities: [],
    error,
  };
}

function mapRows(rows: searchconsole_v1.Schema$ApiDataRow[] | undefined): SearchConsoleMetricRow[] {
  return (rows ?? []).map((row) => ({
    key: row.keys?.[0] ?? "Necunoscut",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: (row.ctr ?? 0) * 100,
    position: row.position ?? 0,
  }));
}

async function querySearchAnalytics(
  searchConsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
  period: { startDate: string; endDate: string },
  dimensions: string[] = [],
  rowLimit = 1000,
) {
  const response = await searchConsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: period.startDate,
      endDate: period.endDate,
      dimensions,
      rowLimit,
      dataState: "final",
    },
  });
  return response.data.rows;
}

export async function getSearchConsoleDashboard(
  websiteId: string,
): Promise<SearchConsoleDashboardData> {
  try {
    const authorized = await getAuthorizedClient(websiteId);
    if (!authorized) {
      return emptySearchConsoleData("Google Search Console is not connected for this website.");
    }
    if (!authorized.integration.external_property_id) {
      return {
        ...emptySearchConsoleData(
          "The Google account is connected, but this domain property was not found in Search Console.",
        ),
        connected: true,
      };
    }

    const property = authorized.integration.external_property_id;
    const searchConsole = google.searchconsole({
      version: "v1",
      auth: authorized.oauth2Client,
    });
    const periods = getPeriods();
    const [totals, queryRows, pageRows, previousPageRows] = await Promise.all([
      querySearchAnalytics(searchConsole, property, periods.current, [], 1),
      querySearchAnalytics(searchConsole, property, periods.current, ["query"], 100),
      querySearchAnalytics(searchConsole, property, periods.current, ["page"], 100),
      querySearchAnalytics(searchConsole, property, periods.previous, ["page"], 100),
    ]);

    await persistRefreshedCredentials(
      authorized.integration,
      authorized.oauth2Client.credentials,
    );
    await createAdminClient()
      .from("integrations")
      .update({ last_synced_at: new Date().toISOString(), status: "active" })
      .eq("id", authorized.integration.id);

    const total = totals?.[0];
    const topQueries = mapRows(queryRows).slice(0, 20);
    const topPages = mapRows(pageRows).slice(0, 20);
    const previousByPage = new Map(
      mapRows(previousPageRows).map((row) => [row.key, row.clicks]),
    );
    const decliningPages = topPages
      .map((page) => {
        const previousClicks = previousByPage.get(page.key) ?? 0;
        return {
          key: page.key,
          clicks: page.clicks,
          previousClicks,
          clickChange: page.clicks - previousClicks,
          impressions: page.impressions,
          position: page.position,
        };
      })
      .filter((page) => page.clickChange < 0)
      .sort((a, b) => a.clickChange - b.clickChange)
      .slice(0, 10);
    const opportunities = topQueries
      .filter(
        (row) =>
          row.impressions >= 50 &&
          row.position >= 4 &&
          row.position <= 20 &&
          row.ctr < 4,
      )
      .map((row) => ({
        ...row,
        reason:
          row.position <= 10
            ? "First page, but CTR can be improved."
            : "Close to top 10 with relevant impressions.",
      }))
      .slice(0, 10);

    return {
      source: "google",
      connected: true,
      property,
      period: periods.current,
      metrics: {
        clicks: total?.clicks ?? 0,
        impressions: total?.impressions ?? 0,
        ctr: (total?.ctr ?? 0) * 100,
        position: total?.position ?? 0,
      },
      topQueries,
      topPages,
      decliningPages,
      opportunities,
    };
  } catch (error) {
    console.error("[search-console] Data could not be loaded:", error);
    return emptySearchConsoleData("Google data could not be loaded.");
  }
}

export async function getSearchConsoleRows(
  websiteId: string,
  dimension: "query" | "page",
) {
  const dashboard = await getSearchConsoleDashboard(websiteId);
  return {
    connected: dashboard.connected,
    source: dashboard.source,
    property: dashboard.property,
    period: dashboard.period,
    data: dimension === "query" ? dashboard.topQueries : dashboard.topPages,
    error: dashboard.error,
  };
}
