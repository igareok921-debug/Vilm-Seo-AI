import { NextResponse } from "next/server";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/languages";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { CrawlCleanupPolicy, NotificationSettings } from "@/lib/supabase/settings";

interface UpdateUserSettingsBody {
  notifications?: Partial<NotificationSettings>;
  crawlCleanupPolicy?: CrawlCleanupPolicy;
  appLanguage?: SupportedLocale;
}

const cleanupPolicies: CrawlCleanupPolicy[] = [
  "disabled",
  "keep_5",
  "keep_10",
  "older_than_30_days",
];

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export async function PATCH(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  let body: UpdateUserSettingsBody;
  try {
    body = (await request.json()) as UpdateUserSettingsBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.notifications) {
    const notifications = body.notifications;
    update.notifications = {
      crawl_completed: normalizeBoolean(notifications.crawl_completed, true),
      audit_completed: normalizeBoolean(notifications.audit_completed, true),
      report_generated: normalizeBoolean(notifications.report_generated, true),
      critical_issues: normalizeBoolean(notifications.critical_issues, true),
      crawl_errors: normalizeBoolean(notifications.crawl_errors, true),
    };
  }

  if (body.crawlCleanupPolicy) {
    if (!cleanupPolicies.includes(body.crawlCleanupPolicy)) {
      return NextResponse.json({ error: "The crawl cleanup policy is not valid." }, { status: 422 });
    }
    update.crawl_cleanup_policy = body.crawlCleanupPolicy;
  }

  if (body.appLanguage) {
    const appLanguage = normalizeLocale(body.appLanguage);
    if (appLanguage !== "en" && appLanguage !== "ro") {
      return NextResponse.json({ error: "Application language is not valid." }, { status: 422 });
    }
    update.app_language = appLanguage;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "There are no settings to save." }, { status: 400 });
  }

  try {
    const { error } = await createAdminClient()
      .from("user_settings")
      .upsert({
        user_id: workspace.user.id,
        ...update,
      }, { onConflict: "user_id" });

    if (error) throw error;

    return NextResponse.json({ data: update });
  } catch (error) {
    console.error("[settings] Preferences could not be saved:", error);
    return NextResponse.json({ error: "Preferences could not be saved." }, { status: 500 });
  }
}
