import "server-only";

import { getDemoContentPlan, getDemoKeywordClusters, getDemoKeywordResearch } from "@/lib/seo/keyword-demo";
import { isDemoModeAllowed } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { containsCaroCakesLeak, isCaroCakesWebsite } from "@/lib/supabase/website-access";
import type {
  AiContentType,
  ContentPlanDataset,
  ContentPlanItem,
  EditorialStatus,
  KeywordCluster,
  KeywordDifficulty,
  KeywordPriority,
  KeywordResearchDataset,
  KeywordResearchItem,
  SearchIntent,
  Website,
} from "@/types";

interface KeywordResearchRow {
  id: string;
  website_id: string;
  keyword: string;
  search_intent: SearchIntent;
  difficulty: KeywordDifficulty;
  priority: KeywordPriority;
  content_type: AiContentType;
  suggested_title: string;
  suggested_meta_description: string;
  suggested_slug: string;
  status: EditorialStatus;
  created_at: string;
}

interface KeywordClusterRow {
  id: string;
  website_id: string;
  cluster_name: string;
  main_keyword: string;
  related_keywords: string[];
  priority: KeywordPriority;
  created_at: string;
}

interface ContentPlanRow {
  id: string;
  website_id: string;
  month: string;
  title: string;
  content_type: AiContentType;
  target_keyword: string;
  outline: string[] | Array<{ title?: string; description?: string; cta?: string }>;
  priority: KeywordPriority;
  status: EditorialStatus;
  created_at: string;
}

interface GeneratedKeywordPageRow {
  id: string;
  keyword: string;
  status: "draft" | "review" | "approved" | "published";
}

export function mapKeywordResearchRow(row: KeywordResearchRow): KeywordResearchItem {
  return {
    id: row.id,
    websiteId: row.website_id,
    keyword: row.keyword,
    searchIntent: row.search_intent,
    difficulty: row.difficulty,
    priority: row.priority,
    contentType: row.content_type,
    suggestedTitle: row.suggested_title,
    suggestedMetaDescription: row.suggested_meta_description,
    suggestedSlug: row.suggested_slug,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapKeywordClusterRow(row: KeywordClusterRow): KeywordCluster {
  return {
    id: row.id,
    websiteId: row.website_id,
    clusterName: row.cluster_name,
    mainKeyword: row.main_keyword,
    relatedKeywords: row.related_keywords ?? [],
    priority: row.priority,
    createdAt: row.created_at,
  };
}

function normalizeOutline(outline: ContentPlanRow["outline"]): string[] {
  if (!Array.isArray(outline)) return [];

  return outline.map((item) => {
    if (typeof item === "string") return item;

    const parts = [item.title, item.description, item.cta].filter(Boolean);
    return parts.join(" - ");
  });
}

export function mapContentPlanRow(row: ContentPlanRow): ContentPlanItem {
  return {
    id: row.id,
    websiteId: row.website_id,
    month: row.month,
    title: row.title,
    contentType: row.content_type,
    targetKeyword: row.target_keyword,
    outline: normalizeOutline(row.outline),
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getKeywordResearchDataset(website: Website): Promise<KeywordResearchDataset> {
  const demo = {
    keywords: getDemoKeywordResearch(website),
    clusters: getDemoKeywordClusters(website),
  };

  if (isDemoModeAllowed()) {
    return { source: "demo", ...demo };
  }

  try {
    const supabase = await createClient();
    const [keywordsResult, clustersResult, generatedPagesResult] = await Promise.all([
      supabase
        .from("keyword_research")
        .select(
          "id, website_id, keyword, search_intent, difficulty, priority, content_type, suggested_title, suggested_meta_description, suggested_slug, status, created_at",
        )
        .eq("website_id", website.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("keyword_clusters")
        .select("id, website_id, cluster_name, main_keyword, related_keywords, priority, created_at")
        .eq("website_id", website.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("generated_pages")
        .select("id, keyword, status")
        .eq("website_id", website.id)
        .order("created_at", { ascending: false }),
    ]);

    if (keywordsResult.error) throw keywordsResult.error;
    if (clustersResult.error) throw clustersResult.error;
    if (generatedPagesResult.error) throw generatedPagesResult.error;

    const keywordRows = (keywordsResult.data as KeywordResearchRow[]).filter(
      (row) => isCaroCakesWebsite(website) || !containsCaroCakesLeak(row),
    );
    const clusterRows = (clustersResult.data as KeywordClusterRow[]).filter(
      (row) => isCaroCakesWebsite(website) || !containsCaroCakesLeak(row),
    );

    const keywords = keywordRows.map(mapKeywordResearchRow);
    const clusters = clusterRows.map(mapKeywordClusterRow);
    const generatedPages = Object.fromEntries(
      ((generatedPagesResult.data ?? []) as GeneratedKeywordPageRow[]).map((page) => [
        page.keyword,
        { id: page.id, status: page.status },
      ]),
    );

    return { source: "supabase", keywords, clusters, generatedPages };
  } catch (error) {
    console.error("Keyword research data could not be loaded:", error);
    return {
      source: "supabase",
      keywords: [],
      clusters: [],
      error: "Keyword research data could not be loaded.",
    };
  }
}

export async function getContentPlanDataset(website: Website): Promise<ContentPlanDataset> {
  const demoPlans = getDemoContentPlan(website);

  if (isDemoModeAllowed()) {
    return { source: "demo", plans: demoPlans };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_plans")
      .select(
        "id, website_id, month, title, content_type, target_keyword, outline, priority, status, created_at",
      )
      .eq("website_id", website.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const planRows = (data as ContentPlanRow[]).filter(
      (row) => isCaroCakesWebsite(website) || !containsCaroCakesLeak(row),
    );
    const plans = planRows.map(mapContentPlanRow);

    return { source: "supabase", plans };
  } catch (error) {
    console.error("Editorial plan could not be loaded:", error);
    return {
      source: "supabase",
      plans: [],
      error: "The editorial plan could not be loaded.",
    };
  }
}
