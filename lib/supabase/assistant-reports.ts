import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import type { AssistantReport } from "@/types";

interface AssistantReportRow {
  id: string;
  website_id: string;
  conversation_id: string | null;
  title: string;
  summary: string;
  report: string;
  type: string;
  created_at: string;
}

function mapAssistantReport(row: AssistantReportRow): AssistantReport {
  return {
    id: row.id,
    websiteId: row.website_id,
    conversationId: row.conversation_id,
    title: row.title,
    summary: row.summary,
    report: row.report,
    type: row.type,
    createdAt: row.created_at,
  };
}

export async function getAssistantReportById(id: string): Promise<AssistantReport | null> {
  if (!id || !isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assistant_reports")
      .select("id, website_id, conversation_id, title, summary, report, type, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapAssistantReport(data as AssistantReportRow) : null;
  } catch (error) {
    console.error("[assistant-reports] Report could not be loaded:", error);
    return null;
  }
}
