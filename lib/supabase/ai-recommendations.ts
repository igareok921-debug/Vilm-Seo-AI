import "server-only";

import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  AiFaqItem,
  AiInternalLinkSuggestion,
  AiRecommendation,
  AiSeoProblem,
} from "@/types";

interface AiRecommendationRow {
  id: string;
  page_id: string;
  model: string;
  seo_score_explanation: string;
  problems: AiSeoProblem[];
  recommended_meta_title: string;
  recommended_meta_description: string;
  recommended_h1: string;
  recommended_faq: AiFaqItem[];
  internal_linking_suggestions: AiInternalLinkSuggestion[];
  content_suggestions: string[];
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number | string;
  created_at: string;
  pages?: { url?: string } | null;
}

export function mapAiRecommendation(row: AiRecommendationRow): AiRecommendation {
  return {
    id: row.id,
    pageId: row.page_id,
    pageUrl: row.pages?.url ?? "",
    model: row.model,
    seoScoreExplanation: row.seo_score_explanation,
    problems: row.problems ?? [],
    recommendedMetaTitle: row.recommended_meta_title,
    recommendedMetaDescription: row.recommended_meta_description,
    recommendedH1: row.recommended_h1,
    recommendedFaq: row.recommended_faq ?? [],
    internalLinkingSuggestions: row.internal_linking_suggestions ?? [],
    contentSuggestions: row.content_suggestions ?? [],
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    estimatedCostUsd: Number(row.estimated_cost_usd),
    createdAt: row.created_at,
  };
}

export async function getWebsiteAiRecommendations(
  websiteId: string,
): Promise<AiRecommendation[]> {
  if (!isSupabaseAdminConfigured()) return [];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_recommendations")
      .select(
        "id, page_id, model, seo_score_explanation, problems, recommended_meta_title, recommended_meta_description, recommended_h1, recommended_faq, internal_linking_suggestions, content_suggestions, input_tokens, output_tokens, total_tokens, estimated_cost_usd, created_at, pages(url)",
      )
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data ?? []).map((row) =>
      mapAiRecommendation(row as unknown as AiRecommendationRow),
    );
  } catch (error) {
    console.error("[ai-recommendations] Recommendations could not be loaded:", error);
    return [];
  }
}
