"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, Building2, CheckCircle2, Languages, Loader2, LockKeyhole, LogOut, Save, Search, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { SupportedLocale } from "@/lib/i18n/languages";
import { createClient } from "@/lib/supabase/client";
import type { CrawlCleanupPolicy, NotificationSettings, SettingsPageData } from "@/lib/supabase/settings";

const navItems = [
  { id: "profil", label: "settings.navProfile", icon: UserRound },
  { id: "language", label: "settings.language", icon: Languages },
  { id: "organizatie", label: "settings.navOrganization", icon: Building2 },
  { id: "utilizare", label: "settings.navUsage", icon: BarChart3 },
  { id: "notificari", label: "settings.navNotifications", icon: Bell },
  { id: "search-console", label: "Google Search Console", icon: Search },
  { id: "securitate", label: "settings.navSecurity", icon: ShieldCheck },
  { id: "crawl", label: "settings.navCrawl", icon: CheckCircle2 },
];

const notificationLabels: Array<{ key: keyof NotificationSettings; label: DictionaryKey }> = [
  { key: "crawl_completed", label: "settings.notifyCrawlCompleted" },
  { key: "audit_completed", label: "settings.notifyAuditCompleted" },
  { key: "report_generated", label: "settings.notifyReportGenerated" },
  { key: "critical_issues", label: "settings.notifyCriticalIssues" },
  { key: "crawl_errors", label: "settings.notifyCrawlErrors" },
];

const crawlPolicies: Array<{ value: CrawlCleanupPolicy; label: DictionaryKey }> = [
  { value: "disabled", label: "settings.policyDisabled" },
  { value: "keep_5", label: "settings.policyKeep5" },
  { value: "keep_10", label: "settings.policyKeep10" },
  { value: "older_than_30_days", label: "settings.policyOlder30" },
];

function formatDate(value: string | null, locale: SupportedLocale, unavailable: string) {
  if (!value) return unavailable;
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getRoleLabel(role: string, t: (key: DictionaryKey) => string) {
  const labels: Record<string, DictionaryKey> = {
    owner: "settings.roleOwner",
    admin: "settings.roleAdmin",
    member: "settings.roleMember",
    client: "settings.roleClient",
  };
  return labels[role] ? t(labels[role]) : role;
}

function formatCost(value: number, locale: SupportedLocale) {
  return new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

async function parseApiResponse(response: Response, fallback: string) {
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok || result.error) {
    throw new Error(result.error ?? fallback);
  }
  return result;
}

export function SettingsPageClient({ data }: { data: SettingsPageData }) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [profileName, setProfileName] = useState(data.profile.fullName);
  const [organizationName, setOrganizationName] = useState(data.organization.name);
  const [notifications, setNotifications] = useState(data.userSettings.notifications);
  const [crawlPolicy, setCrawlPolicy] = useState<CrawlCleanupPolicy>(data.userSettings.crawlCleanupPolicy);
  const [appLanguage, setAppLanguage] = useState<SupportedLocale>(data.userSettings.appLanguage);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState(data.searchConsole.selectedWebsiteId ?? "");
  const [searchConsole, setSearchConsole] = useState(data.searchConsole);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<"delete_account" | "disconnect_gsc" | null>(null);

  const selectedWebsite = useMemo(
    () => data.websites.find((website) => website.id === selectedWebsiteId) ?? null,
    [data.websites, selectedWebsiteId],
  );

  function showSuccess(message: string) {
    setSuccess(message);
    setError("");
  }

  function showError(message: string) {
    setError(message);
    setSuccess("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction("profile");
    try {
      await parseApiResponse(await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: profileName }),
      }), t("settings.profileSaveError"));
      showSuccess(t("settings.profileSaved"));
      router.refresh();
    } catch (saveError) {
      showError(saveError instanceof Error ? saveError.message : t("settings.profileSaveError"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction("organization");
    try {
      await parseApiResponse(await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: organizationName }),
      }), t("settings.organizationSaveError"));
      showSuccess(t("settings.organizationSaved"));
      router.refresh();
    } catch (saveError) {
      showError(saveError instanceof Error ? saveError.message : t("settings.organizationSaveError"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function saveNotifications() {
    setLoadingAction("notifications");
    try {
      await parseApiResponse(await fetch("/api/settings/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications }),
      }), t("settings.notificationsSaveError"));
      showSuccess(t("settings.notificationsSaved"));
      router.refresh();
    } catch (saveError) {
      showError(saveError instanceof Error ? saveError.message : t("settings.notificationsSaveError"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function saveLanguage() {
    setLoadingAction("language");
    try {
      await parseApiResponse(await fetch("/api/settings/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appLanguage }),
      }), t("settings.languageSaveError"));
      setLocale(appLanguage);
      showSuccess(t("settings.languageSaved"));
      router.refresh();
    } catch (saveError) {
      showError(saveError instanceof Error ? saveError.message : t("settings.languageSaveError"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function saveCrawlPolicy() {
    setLoadingAction("crawl");
    try {
      await parseApiResponse(await fetch("/api/settings/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crawlCleanupPolicy: crawlPolicy }),
      }), t("settings.preferencesSaveError"));
      showSuccess(t("settings.preferencesSaved"));
      router.refresh();
    } catch (saveError) {
      showError(saveError instanceof Error ? saveError.message : t("settings.preferencesSaveError"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function syncSearchConsole() {
    if (!selectedWebsiteId) return;
    setLoadingAction("gsc-sync");
    try {
      const result = await parseApiResponse(await fetch("/api/settings/search-console/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: selectedWebsiteId }),
      }), t("settings.syncFailed")) as { data?: { lastSyncedAt?: string } };
      setSearchConsole((current) => ({
        ...current,
        lastSyncedAt: result.data?.lastSyncedAt ?? new Date().toISOString(),
      }));
      showSuccess(t("settings.syncSuccess"));
      router.refresh();
    } catch (syncError) {
      showError(syncError instanceof Error ? syncError.message : t("settings.syncFailed"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function disconnectSearchConsole() {
    if (!selectedWebsiteId) return;
    setLoadingAction("gsc-disconnect");
    try {
      await parseApiResponse(await fetch("/api/settings/search-console", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: selectedWebsiteId }),
      }), t("settings.disconnectFailed"));
      setSearchConsole({
        selectedWebsiteId,
        connected: false,
        googleAccount: null,
        property: null,
        lastSyncedAt: null,
      });
      setConfirmAction(null);
      showSuccess(t("settings.disconnectSuccess"));
      router.refresh();
    } catch (disconnectError) {
      showError(disconnectError instanceof Error ? disconnectError.message : t("settings.disconnectFailed"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function sendPasswordReset() {
    setLoadingAction("password");
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.security.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      showSuccess(t("settings.passwordEmailSent"));
    } catch (resetError) {
      showError(resetError instanceof Error ? resetError.message : t("settings.passwordEmailFailed"));
    } finally {
      setLoadingAction(null);
    }
  }

  async function runSecurityAction(action: "logout_all" | "delete_account") {
    setLoadingAction(action);
    try {
      await parseApiResponse(await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }), t("settings.securityActionFailed"));
      if (action === "delete_account" || action === "logout_all") {
        window.location.href = "/login";
        return;
      }
    } catch (securityError) {
      showError(securityError instanceof Error ? securityError.message : t("settings.securityActionFailed"));
    } finally {
      setLoadingAction(null);
      setConfirmAction(null);
    }
  }

  function switchSearchConsoleWebsite(websiteId: string) {
    setSelectedWebsiteId(websiteId);
    window.location.href = `/settings?websiteId=${websiteId}`;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit p-2 lg:sticky lg:top-24">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <item.icon className="size-4" />
            {item.label === "Google Search Console" ? item.label : t(item.label as DictionaryKey)}
          </a>
        ))}
      </Card>

      <div className="space-y-5">
        {success ? <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{success}</div> : null}
        {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

        <Card id="profil">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.profileTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.profileDescription")}</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={saveProfile}>
              <div className="flex items-center gap-4">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border bg-primary/10 text-lg font-semibold text-primary">
                  {data.profile.avatarUrl ? (
                    <Image src={data.profile.avatarUrl} alt={data.profile.fullName} width={64} height={64} className="h-full w-full object-cover" />
                  ) : (
                    data.profile.fullName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-semibold">{data.profile.fullName}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.createdAt")} {formatDate(data.profile.createdAt, locale, t("settings.unavailable"))}</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="fullName">{t("settings.fullName")}</label>
                  <Input id="fullName" value={profileName} onChange={(event) => setProfileName(event.target.value)} required minLength={2} maxLength={120} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="email">{t("settings.email")}</label>
                  <Input id="email" type="email" value={data.profile.email} disabled />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="profileRole">{t("settings.role")}</label>
                  <Input id="profileRole" value={getRoleLabel(data.profile.role, t)} disabled />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("settings.accountCreatedAt")}</label>
                  <div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{formatDate(data.profile.createdAt, locale, t("settings.unavailable"))}</div>
                </div>
              </div>
              <div className="flex justify-end border-t pt-5">
                <Button disabled={loadingAction === "profile"}>
                  {loadingAction === "profile" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t("settings.saveChanges")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card id="language">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.language")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.languageDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="appLanguage">
                {t("settings.interfaceLanguage")}
              </label>
              <select
                id="appLanguage"
                value={appLanguage}
                onChange={(event) => setAppLanguage(event.target.value as SupportedLocale)}
                className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none transition focus:border-primary sm:max-w-md"
              >
                <option value="en">{t("common.english")}</option>
                <option value="ro">{t("common.romanian")}</option>
              </select>
            </div>
            <div className="flex justify-end border-t pt-5">
              <Button type="button" onClick={saveLanguage} disabled={loadingAction === "language"}>
                {loadingAction === "language" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("settings.saveLanguage")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="organizatie">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.organizationTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.organizationDescription")}</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={saveOrganization}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="organizationName">{t("settings.organizationName")}</label>
                  <Input id="organizationName" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} disabled={!data.organization.canEdit} required minLength={2} maxLength={120} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("settings.slug")}</label>
                  <div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{data.organization.slug}</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("settings.owner")}</label>
                  <div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{data.organization.ownerName} {data.organization.ownerEmail ? `(${data.organization.ownerEmail})` : ""}</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("settings.createdAt")}</label>
                  <div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{formatDate(data.organization.createdAt, locale, t("settings.unavailable"))}</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("settings.websiteCount")}</label>
                  <div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{data.organization.websiteCount}</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("settings.memberCount")}</label>
                  <div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{data.organization.memberCount}</div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-5">
                <p className="text-sm text-muted-foreground">
                  {t("settings.yourOrgRole")}: {getRoleLabel(data.organization.currentUserRole, t)}
                </p>
                <Button disabled={!data.organization.canEdit || loadingAction === "organization"}>
                  {loadingAction === "organization" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t("settings.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card id="utilizare">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.usageTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.usageDescription")}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">{t("settings.crawlsThisMonth")}</p>
                <p className="mt-2 text-2xl font-semibold">{data.usage.crawlsThisMonth}</p>
              </div>
              <div className="rounded-xl border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">{t("settings.aiMessagesToday")}</p>
                <p className="mt-2 text-2xl font-semibold">{data.usage.aiMessagesToday}</p>
              </div>
              <div className="rounded-xl border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">{t("settings.aiGenerationsThisMonth")}</p>
                <p className="mt-2 text-2xl font-semibold">{data.usage.aiGenerationsThisMonth}</p>
              </div>
              <div className="rounded-xl border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">{t("settings.reportsThisMonth")}</p>
                <p className="mt-2 text-2xl font-semibold">{data.usage.reportsThisMonth}</p>
              </div>
              <div className="rounded-xl border bg-background/40 p-4">
                <p className="text-xs text-muted-foreground">{t("settings.estimatedAiCost")}</p>
                <p className="mt-2 text-2xl font-semibold">{formatCost(data.usage.estimatedAiCostThisMonth, locale)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="notificari">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.notificationsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.notificationsDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3">
              {notificationLabels.map((item) => (
                <label key={item.key} className="flex items-center gap-3 rounded-xl border bg-background/40 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={notifications[item.key]}
                    onChange={(event) => setNotifications((current) => ({ ...current, [item.key]: event.target.checked }))}
                    className="size-4 accent-primary"
                  />
                  {t(item.label)}
                </label>
              ))}
            </div>
            <div className="flex justify-end border-t pt-5">
              <Button type="button" onClick={saveNotifications} disabled={loadingAction === "notifications"}>
                {loadingAction === "notifications" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("settings.saveNotifications")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="search-console">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.gscTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.gscDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.websites.length ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="gscWebsite">{t("settings.website")}</label>
                  <select
                    id="gscWebsite"
                    value={selectedWebsiteId}
                    onChange={(event) => switchSearchConsoleWebsite(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none transition focus:border-primary"
                  >
                    {data.websites.map((website) => (
                      <option key={website.id} value={website.id}>
                        {website.name} - {website.url}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border bg-background/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${searchConsole.connected ? "bg-success" : "bg-destructive"}`} />
                        <p className="font-semibold">{searchConsole.connected ? t("settings.connected") : t("settings.notConnected")}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedWebsite?.url ?? t("settings.websiteUnavailable")}</p>
                    </div>
                    <Badge variant={searchConsole.connected ? "success" : "destructive"}>
                      {searchConsole.connected ? t("settings.active") : t("settings.needsConnection")}
                    </Badge>
                  </div>

                  {searchConsole.connected ? (
                    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                      <div><span className="text-muted-foreground">{t("settings.googleAccount")}</span><p className="mt-1 font-medium">{searchConsole.googleAccount ?? t("settings.unavailable")}</p></div>
                      <div><span className="text-muted-foreground">{t("settings.property")}</span><p className="mt-1 font-medium">{searchConsole.property ?? t("settings.propertyUndetected")}</p></div>
                      <div><span className="text-muted-foreground">{t("settings.lastSync")}</span><p className="mt-1 font-medium">{formatDate(searchConsole.lastSyncedAt, locale, t("settings.unavailable"))}</p></div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  {searchConsole.connected ? (
                    <>
                      <Button type="button" onClick={syncSearchConsole} disabled={loadingAction === "gsc-sync"}>
                        {loadingAction === "gsc-sync" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                        {t("settings.syncNow")}
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={`/api/search-console/connect?websiteId=${selectedWebsiteId}`}>{t("settings.reconnect")}</Link>
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => setConfirmAction("disconnect_gsc")}>
                        {t("settings.disconnect")}
                      </Button>
                    </>
                  ) : (
                    <Button asChild>
                      <Link href={`/api/search-console/connect?websiteId=${selectedWebsiteId}`}>{t("settings.connectGsc")}</Link>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                {t("settings.addWebsiteBeforeGsc")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="securitate">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.securityTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.securityDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <div><label className="mb-2 block text-sm font-medium">{t("settings.email")}</label><div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{data.security.email}</div></div>
              <div><label className="mb-2 block text-sm font-medium">{t("settings.provider")}</label><div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{data.security.provider === "google" ? "Google" : "Email + Password"}</div></div>
              <div><label className="mb-2 block text-sm font-medium">{t("settings.lastLogin")}</label><div className="rounded-lg border bg-background/50 px-3 py-2 text-sm">{formatDate(data.security.lastSignInAt, locale, t("settings.unavailable"))}</div></div>
            </div>
            <div className="flex flex-wrap gap-3 border-t pt-5">
              {data.security.provider === "email" ? (
                <Button type="button" variant="outline" onClick={sendPasswordReset} disabled={loadingAction === "password"}>
                  {loadingAction === "password" ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                  {t("settings.changePassword")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => runSecurityAction("logout_all")} disabled={loadingAction === "logout_all"}>
                {loadingAction === "logout_all" ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                {t("settings.logoutAll")}
              </Button>
              <Button type="button" variant="destructive" onClick={() => setConfirmAction("delete_account")}>
                <Trash2 className="size-4" />
                {t("settings.deleteAccount")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="crawl">
          <CardHeader>
            <CardTitle className="text-lg">{t("settings.crawlTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.crawlDescription")}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="crawlPolicy">{t("settings.crawlCleanup")}</label>
              <select
                id="crawlPolicy"
                value={crawlPolicy}
                onChange={(event) => setCrawlPolicy(event.target.value as CrawlCleanupPolicy)}
                className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none transition focus:border-primary"
              >
                {crawlPolicies.map((policy) => (
                  <option key={policy.value} value={policy.value}>{t(policy.label)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end border-t pt-5">
              <Button type="button" onClick={saveCrawlPolicy} disabled={loadingAction === "crawl"}>
                {loadingAction === "crawl" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("settings.savePreferences")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">
              {confirmAction === "delete_account" ? t("settings.confirmDeleteAccountTitle") : t("settings.confirmDisconnectGscTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {confirmAction === "delete_account"
                ? t("settings.confirmDeleteAccountDescription")
                : t("settings.confirmDisconnectGscDescription")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirmAction(null)}>{t("settings.cancel")}</Button>
              <Button
                type="button"
                variant="destructive"
                disabled={loadingAction === "delete_account" || loadingAction === "gsc-disconnect"}
                onClick={() => {
                  if (confirmAction === "delete_account") void runSecurityAction("delete_account");
                  if (confirmAction === "disconnect_gsc") void disconnectSearchConsole();
                }}
              >
                {loadingAction === "delete_account" || loadingAction === "gsc-disconnect" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {confirmAction === "delete_account" ? t("settings.deleteAccount") : t("settings.disconnect")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
