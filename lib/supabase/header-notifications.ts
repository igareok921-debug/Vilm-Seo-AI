import "server-only";

import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";

export interface HeaderNotification {
  id: string;
  action: string;
  description: string;
  websiteName: string;
  websiteId: string;
  createdAt: string;
}

interface ActivityLogRow {
  id: string;
  action: string;
  description: string | null;
  website_id: string | null;
  created_at: string;
}

function logNotificationError(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    console.error("[header] Notifications could not be loaded:", {
      message: typeof record.message === "string" ? record.message : "Supabase error without a message.",
      code: typeof record.code === "string" ? record.code : null,
      details: typeof record.details === "string" ? record.details : null,
      hint: typeof record.hint === "string" ? record.hint : null,
    });
    return;
  }

  console.error("[header] Notifications could not be loaded:", {
    message: error instanceof Error ? error.message : String(error),
    code: null,
    details: null,
    hint: null,
  });
}

export async function getHeaderNotifications(
  websites: Array<{ id: string; name: string }>,
): Promise<HeaderNotification[]> {
  if (!isSupabaseAdminConfigured() || websites.length === 0) return [];

  const websiteNames = new Map(websites.map((website) => [website.id, website.name]));

  try {
    const { data, error } = await createAdminClient()
      .from("activity_logs")
      .select("id, action, description, website_id, created_at")
      .in("website_id", websites.map((website) => website.id))
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) throw error;

    return ((data ?? []) as ActivityLogRow[])
      .filter((activity) => activity.website_id && websiteNames.has(activity.website_id))
      .map((activity) => ({
        id: activity.id,
        action: activity.action,
        description: activity.description ?? activity.action,
        websiteName: websiteNames.get(activity.website_id ?? "") ?? "Website",
        websiteId: activity.website_id ?? "",
        createdAt: activity.created_at,
      }));
  } catch (error) {
    logNotificationError(error);
    return [];
  }
}
