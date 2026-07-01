import "server-only";

import { isDemoModeAllowed, isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import { getWebsites } from "@/lib/supabase/websites";

export type RecommendationImpact = "High" | "Medium" | "Low" | "Ridicat" | "Mediu" | "Redus";
export type RecommendationStatus = "New" | "In progress" | "Planned" | "Draft" | "Resolved" | "Nou" | "În lucru" | "Planificat" | "Rezolvat";
export type RecommendationActionType = "audit" | "optimize" | "content" | "crawl";

export interface SeoRecommendationItem {
  id: string;
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  title: string;
  description: string;
  type: string;
  impact: RecommendationImpact;
  status: RecommendationStatus;
  recommendedAction: string;
  actionType: RecommendationActionType;
  createdAt?: string;
}

interface WebsiteLookup {
  id: string;
  name: string;
  url: string;
}

function getDemoRecommendations(): SeoRecommendationItem[] {
  return [
    {
      id: "demo-carocakes-top-10",
      websiteId: "c0000000-0000-4000-8000-000000000001",
      websiteName: "Caro Cakes",
      websiteUrl: "https://carocakes.md",
      title: "4 carocakes.md pages can reach the top 10",
      description:
        "The pages have a good SEO score, but need content improvements and internal linking for local keywords.",
      type: "SEO Opportunity",
      impact: "High",
      status: "New",
      recommendedAction:
        "Optimize the pages with local keywords and add internal links to custom cakes, candy bar and cupcakes.",
      actionType: "optimize",
    },
    {
      id: "demo-cupcakes-density",
      websiteId: "c0000000-0000-4000-8000-000000000001",
      websiteName: "Caro Cakes",
      websiteUrl: "https://carocakes.md",
      title: "The cupcakes Chisinau page has low keyword density",
      description:
        "The main keyword appears too rarely in the title, H2 and paragraphs, so the page may lose semantic relevance.",
      type: "AI Content",
      impact: "Medium",
      status: "In progress",
      recommendedAction:
        "Add 2-3 natural keyword mentions and expand sections about delivery, pricing and personalization.",
      actionType: "content",
    },
    {
      id: "demo-vilm-alt",
      websiteId: "c0000000-0000-4000-8000-000000000002",
      websiteName: "VILM Group",
      websiteUrl: "https://vilmgroup.md",
      title: "vilmgroup.md has images without ALT",
      description:
        "Images without ALT reduce accessibility and the chance to appear in Google Images results.",
      type: "Audit SEO",
      impact: "Medium",
      status: "New",
      recommendedAction:
        "Add descriptive ALT text for service and digital project images.",
      actionType: "audit",
    },
    {
      id: "demo-vilm-website-page",
      websiteId: "c0000000-0000-4000-8000-000000000002",
      websiteName: "VILM Group",
      websiteUrl: "https://vilmgroup.md",
      title: "The website creation Moldova page needs to be finished",
      description:
        "The generated page is still in draft and can become an important commercial landing page for leads.",
      type: "Generated page",
      impact: "High",
      status: "Draft",
      recommendedAction:
        "Finish the content, check the SEO score in the editor and prepare the page for publishing.",
      actionType: "optimize",
    },
  ];
}

function getWebsite(lookup: Map<string, WebsiteLookup>, websiteId: string) {
  return (
    lookup.get(websiteId) ?? {
      id: websiteId,
      name: "Website",
      url: "",
    }
  );
}

function mapImpact(value: string | null | undefined): RecommendationImpact {
  if (value === "critical" || value === "high" || value === "High" || value === "Ridicat") return "High";
  if (value === "warning" || value === "medium" || value === "Medium" || value === "Mediu") return "Medium";
  return "Low";
}

export async function getSeoRecommendations(): Promise<{
  source: "supabase" | "demo";
  recommendations: SeoRecommendationItem[];
  error?: string;
}> {
  if (isDemoModeAllowed()) {
    return { source: "demo", recommendations: getDemoRecommendations() };
  }

  if (!isSupabaseAdminConfigured()) {
    return {
      source: "supabase",
      recommendations: [],
      error: "Secure server configuration is missing. Recommendations cannot be loaded.",
    };
  }

  try {
    const supabase = createAdminClient();
    const { websites } = await getWebsites();
    const websiteIds = websites.map((website) => website.id);
    if (websiteIds.length === 0) {
      return { source: "supabase", recommendations: [] };
    }

    const [
      aiResult,
      auditsResult,
      keywordsResult,
      generatedPagesResult,
    ] = await Promise.all([
      supabase
        .from("ai_recommendations")
        .select("id, website_id, seo_score_explanation, problems, recommended_meta_title, created_at")
        .in("website_id", websiteIds)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("seo_audits")
        .select("id, website_id, score, status, created_at")
        .in("website_id", websiteIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("keyword_research")
        .select("id, website_id, keyword, priority, difficulty, search_intent, suggested_title, status, created_at")
        .in("website_id", websiteIds)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("generated_pages")
        .select("id, website_id, keyword, title, status, created_at")
        .in("website_id", websiteIds)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    if (aiResult.error) throw aiResult.error;
    if (auditsResult.error) throw auditsResult.error;
    if (keywordsResult.error) throw keywordsResult.error;
    if (generatedPagesResult.error) throw generatedPagesResult.error;

    const websiteLookup = new Map<string, WebsiteLookup>();
    for (const website of websites) {
      websiteLookup.set(website.id, website);
    }

    const recommendations: SeoRecommendationItem[] = [];

    for (const recommendation of aiResult.data ?? []) {
      const website = getWebsite(websiteLookup, recommendation.website_id);
      const problems = Array.isArray(recommendation.problems) ? recommendation.problems : [];
      const firstProblem = problems[0] as
        | { problem?: string; priority?: string; recommendation?: string }
        | undefined;

      recommendations.push({
        id: `ai-${recommendation.id}`,
        websiteId: recommendation.website_id,
        websiteName: website.name,
        websiteUrl: website.url,
        title: firstProblem?.problem ?? recommendation.recommended_meta_title ?? "AI SEO recommendation",
        description: recommendation.seo_score_explanation,
        type: "AI Recommendations",
        impact: mapImpact(firstProblem?.priority),
        status: "New",
        recommendedAction:
          firstProblem?.recommendation ?? "Apply the AI recommendations for title, meta description and H1.",
        actionType: "optimize",
        createdAt: recommendation.created_at,
      });
    }

    const auditIds = (auditsResult.data ?? []).map((audit) => audit.id);
    if (auditIds.length > 0) {
      const { data: issues, error: issuesError } = await supabase
        .from("audit_issues")
        .select("id, audit_id, title, description, severity, recommendation, is_resolved, created_at")
        .in("audit_id", auditIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (issuesError) throw issuesError;

      const auditWebsite = new Map(
        (auditsResult.data ?? []).map((audit) => [audit.id, audit.website_id] as const),
      );

      for (const issue of issues ?? []) {
        const websiteId = auditWebsite.get(issue.audit_id);
        if (!websiteId) continue;

        const website = getWebsite(websiteLookup, websiteId);
        recommendations.push({
          id: `audit-${issue.id}`,
          websiteId,
          websiteName: website.name,
          websiteUrl: website.url,
          title: issue.title,
          description: issue.description ?? "Issue detected in the SEO audit.",
          type: "Audit SEO",
          impact: mapImpact(issue.severity),
          status: issue.is_resolved ? "Resolved" : "New",
          recommendedAction: issue.recommendation ?? "Open the audit and apply the recommended fix.",
          actionType: "audit",
          createdAt: issue.created_at,
        });
      }
    }

    for (const audit of auditsResult.data ?? []) {
      if (Number(audit.score) >= 80) continue;

      const website = getWebsite(websiteLookup, audit.website_id);
      recommendations.push({
        id: `audit-score-${audit.id}`,
        websiteId: audit.website_id,
        websiteName: website.name,
        websiteUrl: website.url,
        title: `SEO score below threshold: ${audit.score}/100`,
        description: "The website needs a technical and content review for organic growth.",
        type: "SEO Audit",
        impact: Number(audit.score) < 70 ? "High" : "Medium",
        status: audit.status === "completed" ? "New" : "In progress",
        recommendedAction: "Open the audit, resolve critical issues and run a new crawl.",
        actionType: "audit",
        createdAt: audit.created_at,
      });
    }

    for (const keyword of keywordsResult.data ?? []) {
      if (keyword.priority !== "high") continue;

      const website = getWebsite(websiteLookup, keyword.website_id);
      recommendations.push({
        id: `keyword-${keyword.id}`,
        websiteId: keyword.website_id,
        websiteName: website.name,
        websiteUrl: website.url,
        title: `Keyword opportunity: ${keyword.keyword}`,
        description: `${keyword.suggested_title} · intent ${keyword.search_intent}, difficulty ${keyword.difficulty}.`,
        type: "Keyword Research",
        impact: "High",
        status: keyword.status === "published" ? "Resolved" : "Planned",
        recommendedAction: "Generate or finish dedicated content for this keyword.",
        actionType: "content",
        createdAt: keyword.created_at,
      });
    }

    for (const page of generatedPagesResult.data ?? []) {
      if (page.status === "published") continue;

      const website = getWebsite(websiteLookup, page.website_id);
      recommendations.push({
        id: `generated-${page.id}`,
        websiteId: page.website_id,
        websiteName: website.name,
        websiteUrl: website.url,
        title: `${page.title} needs to be finished`,
        description: `The page for keyword "${page.keyword}" is currently in ${page.status} status.`,
        type: "Generated page",
        impact: page.status === "draft" ? "High" : "Medium",
        status: page.status === "draft" ? "Draft" : "In progress",
        recommendedAction: "Open the SEO editor, check the score and prepare the page for publishing.",
        actionType: "optimize",
        createdAt: page.created_at,
      });
    }

    if (recommendations.length === 0) {
      return { source: "supabase", recommendations: [] };
    }

    return {
      source: "supabase",
      recommendations: recommendations.slice(0, 60),
    };
  } catch (error) {
    console.error("[recommendations] SEO recommendations could not be loaded:", error);
    return {
      source: "supabase",
      recommendations: [],
      error: "Recommendations could not be loaded.",
    };
  }
}

export function getRecommendationHref(actionType: RecommendationActionType, websiteId: string) {
  const query = `websiteId=${encodeURIComponent(websiteId)}`;

  if (actionType === "audit") return `/audit?${query}`;
  if (actionType === "optimize") return `/content/generated?${query}`;
  if (actionType === "content") return `/keywords?${query}`;
  return `/crawl?${query}`;
}
