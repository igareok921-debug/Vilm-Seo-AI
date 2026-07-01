import "server-only";

import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "@/lib/i18n/languages";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getWebsites } from "@/lib/supabase/websites";
import { getUsageSummary } from "@/lib/usage/check-limits";

export type CrawlCleanupPolicy = "disabled" | "keep_5" | "keep_10" | "older_than_30_days";

export interface NotificationSettings {
  crawl_completed: boolean;
  audit_completed: boolean;
  report_generated: boolean;
  critical_issues: boolean;
  crawl_errors: boolean;
}

export interface SettingsPageData {
  profile: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: string;
    createdAt: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    ownerName: string;
    ownerEmail: string;
    createdAt: string | null;
    websiteCount: number;
    memberCount: number;
    currentUserRole: string;
    canEdit: boolean;
  };
  security: {
    email: string;
    provider: "google" | "email";
    lastSignInAt: string | null;
  };
  userSettings: {
    notifications: NotificationSettings;
    crawlCleanupPolicy: CrawlCleanupPolicy;
    appLanguage: SupportedLocale;
  };
  websites: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  searchConsole: {
    selectedWebsiteId: string | null;
    connected: boolean;
    googleAccount: string | null;
    property: string | null;
    lastSyncedAt: string | null;
  };
  usage: {
    crawlsThisMonth: number;
    aiMessagesToday: number;
    aiGenerationsThisMonth: number;
    reportsThisMonth: number;
    estimatedAiCostThisMonth: number;
  };
}

const defaultNotifications: NotificationSettings = {
  crawl_completed: true,
  audit_completed: true,
  report_generated: true,
  critical_issues: true,
  crawl_errors: true,
};

function normalizeNotifications(value: unknown): NotificationSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    crawl_completed: typeof source.crawl_completed === "boolean" ? source.crawl_completed : defaultNotifications.crawl_completed,
    audit_completed: typeof source.audit_completed === "boolean" ? source.audit_completed : defaultNotifications.audit_completed,
    report_generated: typeof source.report_generated === "boolean" ? source.report_generated : defaultNotifications.report_generated,
    critical_issues: typeof source.critical_issues === "boolean" ? source.critical_issues : defaultNotifications.critical_issues,
    crawl_errors: typeof source.crawl_errors === "boolean" ? source.crawl_errors : defaultNotifications.crawl_errors,
  };
}

function normalizeCleanupPolicy(value: unknown): CrawlCleanupPolicy {
  return value === "keep_5" || value === "keep_10" || value === "older_than_30_days"
    ? value
    : "disabled";
}

async function getAuthSecurity() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const provider = user?.app_metadata?.provider === "google" ? "google" : "email";

  return {
    email: user?.email ?? "",
    provider: provider as "google" | "email",
    lastSignInAt: user?.last_sign_in_at ?? null,
    createdAt: user?.created_at ?? null,
  };
}

export async function getSettingsPageData(searchParams?: {
  websiteId?: string;
}): Promise<SettingsPageData | null> {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) return null;

  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const admin = createAdminClient();
  const security = await getAuthSecurity();

  const [
    profileResult,
    organizationResult,
    membersCountResult,
    websitesResult,
    settingsResult,
    usageSummary,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, avatar_url, role, created_at")
      .eq("id", workspace.user.id)
      .maybeSingle(),
    admin
      .from("organizations")
      .select("id, name, slug, owner_id, created_at, profiles!organizations_owner_id_fkey(full_name, email)")
      .eq("id", workspace.organization.id)
      .maybeSingle(),
    admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.organization.id),
    getWebsites(workspace.organization.id),
    admin
      .from("user_settings")
      .select("notifications, crawl_cleanup_policy, app_language")
      .eq("user_id", workspace.user.id)
      .maybeSingle(),
    getUsageSummary(workspace.organization.id),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (organizationResult.error) throw organizationResult.error;
  if (membersCountResult.error) throw membersCountResult.error;

  const settings = settingsResult.data;
  if (settingsResult.error) throw settingsResult.error;
  if (!settings) {
    const { error } = await admin.from("user_settings").insert({
      user_id: workspace.user.id,
      notifications: defaultNotifications,
      crawl_cleanup_policy: "disabled",
      app_language: DEFAULT_LOCALE,
    });
    if (error && error.code !== "23505") throw error;
  }

  const websites = websitesResult.websites.map((website) => ({
    id: website.id,
    name: website.name,
    url: website.url,
  }));
  const selectedWebsite =
    websites.find((website) => website.id === searchParams?.websiteId) ?? websites[0] ?? null;

  const websiteCountResult = await admin
    .from("websites")
    .select("id", { count: "exact", head: true })
    .or(`owner_organization_id.eq.${workspace.organization.id},and(owner_organization_id.is.null,organization_id.eq.${workspace.organization.id})`);
  if (websiteCountResult.error) throw websiteCountResult.error;

  const integrationResult = selectedWebsite
    ? await admin
      .from("integrations")
      .select("status, external_property_id, metadata, last_synced_at")
      .eq("website_id", selectedWebsite.id)
      .eq("provider", "google_search_console")
      .eq("status", "active")
      .maybeSingle()
    : { data: null, error: null };
  if (integrationResult.error) throw integrationResult.error;

  const integration = integrationResult.data as {
    status?: string;
    external_property_id?: string | null;
    metadata?: Record<string, unknown> | null;
    last_synced_at?: string | null;
  } | null;

  const profile = profileResult.data as {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    created_at: string | null;
  } | null;
  const organization = organizationResult.data as {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    created_at: string | null;
    profiles?: { full_name: string | null; email: string | null } | null;
  } | null;

  if (!profile || !organization) return null;

  const metadata = integration?.metadata ?? {};
  const googleAccount =
    typeof metadata.google_account_email === "string"
      ? metadata.google_account_email
      : typeof metadata.email === "string"
        ? metadata.email
        : integration
          ? workspace.profile.email
          : null;

  return {
    profile: {
      id: profile.id,
      fullName: profile.full_name ?? workspace.profile.fullName,
      email: profile.email ?? workspace.user.email,
      avatarUrl: profile.avatar_url ?? workspace.profile.avatarUrl,
      role: profile.role ?? workspace.profile.role,
      createdAt: profile.created_at ?? security.createdAt,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      ownerName: organization.profiles?.full_name ?? "Owner",
      ownerEmail: organization.profiles?.email ?? "",
      createdAt: organization.created_at,
      websiteCount: websiteCountResult.count ?? websites.length,
      memberCount: membersCountResult.count ?? 0,
      currentUserRole: workspace.organization.role,
      canEdit: workspace.organization.role === "owner",
    },
    security: {
      email: security.email || workspace.user.email,
      provider: security.provider,
      lastSignInAt: security.lastSignInAt,
    },
    userSettings: {
      notifications: normalizeNotifications(settings?.notifications),
      crawlCleanupPolicy: normalizeCleanupPolicy(settings?.crawl_cleanup_policy),
      appLanguage: normalizeLocale(settings?.app_language),
    },
    websites,
    searchConsole: {
      selectedWebsiteId: selectedWebsite?.id ?? null,
      connected: Boolean(integration),
      googleAccount,
      property: integration?.external_property_id ?? null,
      lastSyncedAt: integration?.last_synced_at ?? null,
    },
    usage: usageSummary,
  };
}
