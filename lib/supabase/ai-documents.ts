import "server-only";

import { isDemoModeAllowed, isSupabaseConfigured } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { containsCaroCakesLeak, isCaroCakesWebsite } from "@/lib/supabase/website-access";
import type { AiDocument, AiDocumentsDataset, AiDocumentTone, AiDocumentType, Website } from "@/types";

interface AiDocumentRow {
  id: string;
  website_id: string;
  type: AiDocumentType;
  keyword: string | null;
  title: string;
  content: AiDocument["content"];
  status: AiDocument["status"];
  language: string;
  tone: AiDocumentTone;
  created_at: string;
  updated_at: string;
}

export function mapAiDocumentRow(row: AiDocumentRow): AiDocument {
  return {
    id: row.id,
    websiteId: row.website_id,
    type: row.type,
    keyword: row.keyword,
    title: row.title,
    content: row.content ?? {},
    status: row.status,
    language: row.language,
    tone: row.tone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAiDocumentsDataset(websites: Website[]): Promise<AiDocumentsDataset> {
  if (isDemoModeAllowed()) {
    return {
      source: "demo",
      documents: [],
      error: "Platform storage is not configured. Real AI documents will appear after setup is complete.",
    };
  }

  try {
    const websiteIds = websites.map((website) => website.id);
    if (websiteIds.length === 0) return { source: "supabase", documents: [] };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_documents")
      .select("id, website_id, type, keyword, title, content, status, language, tone, created_at, updated_at")
      .in("website_id", websiteIds)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    const websiteLookup = new Map(websites.map((website) => [website.id, website]));

    return {
      source: "supabase",
      documents: ((data ?? []) as AiDocumentRow[])
        .filter((row) => {
          const website = websiteLookup.get(row.website_id);
          return !website || isCaroCakesWebsite(website) || !containsCaroCakesLeak(row);
        })
        .map(mapAiDocumentRow),
    };
  } catch (error) {
    console.error("AI documents could not be loaded:", error);
    return {
      source: "supabase",
      documents: [],
      error: "AI documents could not be loaded.",
    };
  }
}

export async function getAiDocumentById(id: string): Promise<AiDocument | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_documents")
      .select("id, website_id, type, keyword, title, content, status, language, tone, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapAiDocumentRow(data as AiDocumentRow) : null;
  } catch (error) {
    console.error(`AI document ${id} could not be loaded:`, error);
    return null;
  }
}
