import "server-only";

import { getSearchConsoleDashboard } from "@/lib/google/search-console";
import { websites as demoWebsites } from "@/lib/data";
import { createDemoGeneratedPage } from "@/lib/seo/generated-page-demo";
import { getDemoKeywordResearch } from "@/lib/seo/keyword-demo";
import { getWebsiteAiRecommendations } from "@/lib/supabase/ai-recommendations";
import { getWebsiteCrawlData } from "@/lib/supabase/crawl-data";
import { mapGeneratedPageRow } from "@/lib/supabase/generated-pages";
import { mapKeywordResearchRow } from "@/lib/supabase/keyword-research";
import { isDemoModeAllowed, isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import { getWebsiteById } from "@/lib/supabase/websites";
import { getOwnedWebsiteForCurrentUser } from "@/lib/supabase/website-access";
import type {
  AssistantContextSnapshot,
  AssistantConversation,
  AssistantMessage,
  GeneratedPage,
  KeywordResearchItem,
  Website,
} from "@/types";

interface ConversationRow {
  id: string;
  website_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  website_id: string | null;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

function mapConversation(row: ConversationRow): AssistantConversation {
  return {
    id: row.id,
    websiteId: row.website_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): AssistantMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    websiteId: row.website_id,
    role: row.role,
    content: row.content,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function getDemoWebsite(websiteId?: string | null) {
  return demoWebsites.find((website) => website.id === websiteId) ?? demoWebsites[0] ?? null;
}

export async function getAssistantConversationForWebsite(websiteId: string): Promise<AssistantConversation | null> {
  if (!websiteId) return null;

  if (!isSupabaseAdminConfigured() && isDemoModeAllowed()) {
    const now = new Date().toISOString();
    return {
      id: `demo-conversation-${websiteId}`,
      websiteId,
      title: "SEO Conversation",
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }
  if (!isSupabaseAdminConfigured()) return null;

  try {
    const { organizationId } = await getOwnedWebsiteForCurrentUser(websiteId);
    const supabase = createAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("assistant_conversations")
      .select("id, website_id, title, created_at, updated_at")
      .eq("website_id", websiteId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    let conversation = existing as ConversationRow | null;

    if (!conversation) {
      const { data: created, error: createError } = await supabase
        .from("assistant_conversations")
        .insert({
          website_id: websiteId,
          organization_id: organizationId,
          title: "SEO Conversation",
        })
        .select("id, website_id, title, created_at, updated_at")
        .single();

      if (createError) throw createError;
      conversation = created as ConversationRow;
    }

    const { count } = await supabase
      .from("assistant_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id);

    return {
      ...mapConversation(conversation),
      messageCount: count ?? 0,
    };
  } catch (error) {
    console.error("[assistant] Website conversation could not be loaded:", error);
    return null;
  }
}

export async function getAssistantConversationById(
  websiteId: string,
  conversationId?: string | null,
): Promise<AssistantConversation | null> {
  if (!websiteId || !conversationId) return getAssistantConversationForWebsite(websiteId);

  if (!isSupabaseAdminConfigured() && isDemoModeAllowed()) {
    return {
      id: conversationId,
      websiteId,
      title: "SEO Conversation",
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  if (!isSupabaseAdminConfigured()) return null;

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id, website_id, title, created_at, updated_at")
      .eq("id", conversationId)
      .eq("website_id", websiteId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return getAssistantConversationForWebsite(websiteId);

    const { count } = await supabase
      .from("assistant_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", data.id);

    return {
      ...mapConversation(data as ConversationRow),
      messageCount: count ?? 0,
    };
  } catch (error) {
    console.error("[assistant] Selected conversation could not be loaded:", error);
    return getAssistantConversationForWebsite(websiteId);
  }
}

export async function getAssistantConversationsForWebsite(websiteId: string): Promise<AssistantConversation[]> {
  if (!websiteId) return [];

  if (!isSupabaseAdminConfigured() && isDemoModeAllowed()) {
    const now = new Date().toISOString();
    return [
      {
        id: `demo-conversation-${websiteId}`,
        websiteId,
        title: "SEO Conversation",
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
  if (!isSupabaseAdminConfigured()) return [];

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id, website_id, title, created_at, updated_at")
      .eq("website_id", websiteId)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error) throw error;
    const conversations = (data ?? []).map((row) => mapConversation(row as ConversationRow));

    const counts = await Promise.all(
      conversations.map(async (conversation) => {
        const { count } = await supabase
          .from("assistant_messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversation.id);
        return [conversation.id, count ?? 0] as const;
      }),
    );
    const countMap = new Map(counts);

    return conversations.map((conversation) => ({
      ...conversation,
      messageCount: countMap.get(conversation.id) ?? 0,
    }));
  } catch (error) {
    console.error("[assistant] Conversation history could not be loaded:", error);
    return [];
  }
}

export async function getAssistantMessages(conversationId?: string | null): Promise<AssistantMessage[]> {
  if (!conversationId || !isSupabaseAdminConfigured()) return [];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("assistant_messages")
      .select("id, conversation_id, website_id, role, content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data ?? [])
      .reverse()
      .map((row) => mapMessage(row as MessageRow));
  } catch (error) {
    console.error("[assistant] Messages could not be loaded:", error);
    return [];
  }
}

async function getAssistantActivityLogs(websiteId: string) {
  if (!isSupabaseAdminConfigured()) return [];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("activity_logs")
      .select("action, description, created_at")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return (data ?? []).map((row) => ({
      action: row.action,
      description: row.description,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("[assistant] Activity logs could not be loaded:", error);
    return [];
  }
}

async function getAssistantKeywords(website: Website): Promise<KeywordResearchItem[]> {
  if (!isSupabaseAdminConfigured()) {
    return isDemoModeAllowed() ? getDemoKeywordResearch(website) : [];
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("keyword_research")
      .select(
        "id, website_id, keyword, search_intent, difficulty, priority, content_type, suggested_title, suggested_meta_description, suggested_slug, status, created_at",
      )
      .eq("website_id", website.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    const rows = (data ?? []).map((row) => mapKeywordResearchRow(row));
    return rows;
  } catch (error) {
    console.error("[assistant] Keywords could not be loaded:", error);
    return [];
  }
}

async function getAssistantGeneratedPages(website: Website): Promise<GeneratedPage[]> {
  if (!isSupabaseAdminConfigured()) {
    return isDemoModeAllowed() ? [createDemoGeneratedPage(website)] : [];
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("generated_pages")
      .select(
        "id, website_id, keyword, title, meta_title, meta_description, slug, content, faq_schema, status, created_at, updated_at",
      )
      .eq("website_id", website.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    const pages = (data ?? []).map((row) => mapGeneratedPageRow(row));
    return pages;
  } catch (error) {
    console.error("[assistant] Generated pages could not be loaded:", error);
    return [];
  }
}

export async function buildAssistantContext(websiteId: string): Promise<AssistantContextSnapshot> {
  const website = (await getWebsiteById(websiteId)) ?? (isDemoModeAllowed() ? getDemoWebsite(websiteId) : null);
  if (!website) {
    return {
      website: null,
      seoScore: null,
      pagesIndexed: 0,
      pagesNotIndexed: 0,
      primaryKeyword: null,
      lastCrawl: null,
      lastAudit: null,
      crawl: { pages: [], issues: [] },
      keywords: [],
      generatedPages: [],
      recommendations: [],
      searchConsole: null,
      analytics: null,
      activityLogs: [],
      contextFlags: {
        crawl: false,
        searchConsole: false,
        keywords: false,
        aiContent: false,
        auditSeo: false,
        generatedPages: false,
        recommendations: false,
        analytics: false,
      },
    };
  }

  const [crawl, keywords, generatedPages, recommendations, activityLogs] = await Promise.all([
    getWebsiteCrawlData(website.id),
    getAssistantKeywords(website),
    getAssistantGeneratedPages(website),
    getWebsiteAiRecommendations(website.id),
    getAssistantActivityLogs(website.id),
  ]);

  let searchConsole = null;
  try {
    searchConsole = await getSearchConsoleDashboard(website.id);
  } catch {
    searchConsole = null;
  }

  const pagesIndexed = crawl.pages.filter((page) => page.statusCode && page.statusCode < 400).length;
  const pagesNotIndexed = crawl.pages.filter((page) => page.statusCode && page.statusCode >= 400).length;
  const primaryKeyword =
    keywords.find((keyword) => keyword.priority === "high")?.keyword ??
    keywords[0]?.keyword ??
    null;
  const crawlLog = activityLogs.find((log) => log.action.includes("crawl"));

  return {
    website,
    seoScore: crawl.audit?.score ?? null,
    pagesIndexed,
    pagesNotIndexed,
    primaryKeyword,
    lastCrawl: crawlLog
      ? {
          status: "completed",
          pagesCrawled: crawl.pages.length,
          issuesFound: crawl.issues.length,
          createdAt: crawlLog.createdAt,
        }
      : null,
    lastAudit: crawl.audit
      ? {
          score: crawl.audit.score,
          status: crawl.audit.status,
          completedAt: crawl.audit.completedAt,
        }
      : null,
    crawl: {
      pages: crawl.pages.slice(0, 50),
      issues: crawl.issues.slice(0, 50),
    },
    keywords: keywords.slice(0, 80),
    generatedPages: generatedPages.slice(0, 30),
    recommendations: recommendations.slice(0, 30),
    searchConsole,
    analytics: null,
    activityLogs,
    contextFlags: {
      crawl: crawl.pages.length > 0,
      searchConsole: Boolean(searchConsole),
      keywords: keywords.length > 0,
      aiContent: generatedPages.length > 0,
      auditSeo: Boolean(crawl.audit),
      generatedPages: generatedPages.length > 0,
      recommendations: recommendations.length > 0,
      analytics: false,
    },
  };
}
