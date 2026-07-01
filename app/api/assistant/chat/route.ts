import OpenAI from "openai";
import { getLanguageName, normalizeLocale } from "@/lib/i18n/languages";
import { openAiConfig } from "@/lib/openai";
import {
  buildAssistantContext,
  getAssistantConversationById,
  getAssistantConversationForWebsite,
  getAssistantConversationsForWebsite,
  getAssistantMessages,
} from "@/lib/supabase/assistant-context";
import { isDemoModeAllowed, isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";

export const maxDuration = 180;

interface ChatBody {
  websiteId?: unknown;
  message?: unknown;
  conversationId?: unknown;
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function createConversationTitle(message: string) {
  return message.trim().slice(0, 80) || "SEO Conversation";
}

function shouldSaveAsReport(message: string, answer: string) {
  return /raport|analiz[ăa]|audit complet|plan complet/i.test(message) || answer.length > 2400;
}

function createReportSummary(answer: string) {
  return answer
    .replace(/[#*_`>-]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" ")
    .slice(0, 600);
}

function estimateChatCost(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.6;
}

function contextForPrompt(context: Awaited<ReturnType<typeof buildAssistantContext>>) {
  return {
    website: context.website,
    seoScore: context.seoScore,
    pagesIndexed: context.pagesIndexed,
    pagesNotIndexed: context.pagesNotIndexed,
    primaryKeyword: context.primaryKeyword,
    lastCrawl: context.lastCrawl,
    lastAudit: context.lastAudit,
    crawl: {
      pages: context.crawl.pages.slice(0, 20),
      issues: context.crawl.issues.slice(0, 20),
    },
    keywords: context.keywords.slice(0, 30),
    generatedPages: context.generatedPages.map((page) => ({
      keyword: page.keyword,
      title: page.title,
      slug: page.slug,
      status: page.status,
      seoTitle: page.metaTitle,
      metaDescription: page.metaDescription,
    })),
    recommendations: context.recommendations.slice(0, 12),
    searchConsole: context.searchConsole,
    analytics: context.analytics,
    activityLogs: context.activityLogs.slice(0, 12),
    contextFlags: context.contextFlags,
  };
}

async function persistAssistantMessage(input: {
  conversationId: string | null;
  websiteId: string;
  assistantMessage: string;
  snapshotId: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseAdminConfigured() || !input.conversationId) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      conversation_id: input.conversationId,
      website_id: input.websiteId,
      context_snapshot_id: input.snapshotId,
      role: "assistant",
      content: input.assistantMessage,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[assistant/chat] AI message could not be saved:", error);
    return null;
  }

  await supabase
    .from("assistant_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);

  return data.id as string;
}

async function ensureWebsiteConversation(
  websiteId: string,
  organizationId: string | null,
  titleSeed = "SEO Conversation",
  conversationId?: string | null,
) {
  if (!isSupabaseAdminConfigured()) {
    if (!isDemoModeAllowed()) {
      return { conversationId: null };
    }

    return {
      conversationId: conversationId ?? `demo-conversation-${websiteId}`,
    };
  }

  const supabase = createAdminClient();
  if (conversationId) {
    const { data: selected, error: selectedError } = await supabase
      .from("assistant_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("website_id", websiteId)
      .maybeSingle();

    if (selectedError) throw selectedError;
    if (selected?.id) return { conversationId: selected.id as string };
  }

  const { data: existing, error: existingError } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("website_id", websiteId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return { conversationId: existing.id as string };

  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({
      website_id: websiteId,
      organization_id: organizationId,
      title: createConversationTitle(titleSeed),
    })
    .select("id")
    .single();

  if (error) throw error;
  return { conversationId: data.id as string };
}

async function preparePersistence(
  websiteId: string,
  organizationId: string | null,
  message: string,
  conversationId?: string | null,
) {
  const ensured = await ensureWebsiteConversation(websiteId, organizationId, message, conversationId);

  if (!isSupabaseAdminConfigured()) {
    return {
      conversationId: ensured.conversationId,
      snapshotId: null as string | null,
    };
  }

  const supabase = createAdminClient();

  await supabase.from("assistant_messages").insert({
    conversation_id: ensured.conversationId,
    website_id: websiteId,
    role: "user",
    content: message,
  });

  await supabase
    .from("assistant_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ensured.conversationId)
    .eq("website_id", websiteId);

  return {
    conversationId: ensured.conversationId,
    snapshotId: null as string | null,
  };
}

async function saveAssistantReport(input: {
  websiteId: string;
  conversationId: string | null;
  question: string;
  answer: string;
}) {
  if (!isSupabaseAdminConfigured() || !input.conversationId) return null;

  const supabase = createAdminClient();
  const title = input.question.slice(0, 90) || "SEO Report";
  const { data, error } = await supabase
    .from("assistant_reports")
    .insert({
      website_id: input.websiteId,
      conversation_id: input.conversationId,
      title,
      summary: createReportSummary(input.answer),
      report: input.answer,
      type: /plan/i.test(input.question) ? "growth_plan" : "seo_analysis",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[assistant/chat] Report could not be saved:", error);
    return null;
  }

  return data.id as string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId")?.trim() ?? "";
  const conversationId = searchParams.get("conversationId")?.trim() ?? null;

  if (!websiteId) {
    return Response.json({ error: "websiteId is required." }, { status: 422 });
  }

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
    const [conversation, context, conversations] = await Promise.all([
      conversationId
        ? getAssistantConversationById(websiteId, conversationId)
        : getAssistantConversationForWebsite(websiteId),
      buildAssistantContext(websiteId),
      getAssistantConversationsForWebsite(websiteId),
    ]);
    const messages = await getAssistantMessages(conversation?.id);

    return Response.json({
      data: {
        conversation,
        conversations,
        messages,
        context,
      },
    });
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;

    console.error("[assistant/chat] Conversation could not be loaded:", error);
    return Response.json(
      { error: "The website conversation could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: ChatBody;

  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return new Response("The request body must be valid JSON.", { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const requestedConversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : null;
  if (!websiteId || !message) {
    return new Response("websiteId and message are required.", { status: 422 });
  }

  let organizationId: string | null = null;
  let userId: string | null = null;
  try {
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    organizationId = access.organizationId;
    userId = access.workspace.user.id;
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;
    throw error;
  }

  if (!openAiConfig.apiKey) {
    return new Response("OPENAI_API_KEY is not configured. AI Copilot cannot generate responses.", {
      status: 503,
    });
  }

  try {
    await checkUsageLimit({
      organizationId,
      userId,
      websiteId,
      eventType: "assistant.message",
    });
  } catch (error) {
    const usageError = getUsageLimitErrorResponse(error);
    if (usageError) return usageError;
    throw error;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let activeConversationId: string | null = null;
      let snapshotId: string | null = null;
      let fullAnswer = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let totalTokens = 0;

      try {
        const persistence = await preparePersistence(websiteId, organizationId, message, requestedConversationId);
        activeConversationId = persistence.conversationId;

        const context = await buildAssistantContext(websiteId);
        const history = await getAssistantMessages(activeConversationId);

        if (isSupabaseAdminConfigured() && activeConversationId) {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("assistant_context_snapshots")
            .insert({
              conversation_id: activeConversationId,
              website_id: websiteId,
              snapshot: context,
            })
            .select("id")
            .single();

          if (!error) snapshotId = data.id as string;
        }

        controller.enqueue(
          encoder.encode(
            sse("meta", {
              conversationId: activeConversationId,
              snapshotId,
              contextFlags: context.contextFlags,
              sidebar: {
                seoScore: context.seoScore,
                pagesIndexed: context.pagesIndexed,
                pagesNotIndexed: context.pagesNotIndexed,
                primaryKeyword: context.primaryKeyword,
                lastCrawl: context.lastCrawl,
                lastAudit: context.lastAudit,
              },
            }),
          ),
        );

        const openai = new OpenAI({
          apiKey: openAiConfig.apiKey,
          timeout: 120_000,
          maxRetries: 2,
        });
        const outputLanguage = getLanguageName(normalizeLocale(context.website?.language));

        const completion = await openai.chat.completions.create({
          model: openAiConfig.model,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            {
              role: "system",
              content:
                `You are VILM AI SEO Copilot, a Senior SEO Consultant. You are not a generic chat assistant. Answer only from the selected websiteId and the SEO context provided. Never mix data between websites. Write in ${outputLanguage}. Keep answers conversational, short and action-oriented: Summary, 3 priorities, Actions. If the user asks for a large analysis or report, provide only the summary in chat and state that the full report can be opened separately. Use Markdown and include relevant quick actions: Run Crawl, Generate Page, Optimize, View Keyword, Open Audit.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                websiteId,
                question: message,
                previousConversation: history.slice(-12).map((item) => ({
                  role: item.role,
                  content: item.content.slice(0, 1200),
                  createdAt: item.createdAt,
                })),
                context: contextForPrompt(context),
              }),
            },
          ],
        });

        for await (const chunk of completion) {
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
            outputTokens = chunk.usage.completion_tokens ?? outputTokens;
            totalTokens = chunk.usage.total_tokens ?? totalTokens;
          }
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (!text) continue;
          fullAnswer += text;
          controller.enqueue(encoder.encode(sse("token", { text })));
        }

        let assistantMessage = fullAnswer;
        let metadata: Record<string, unknown> = {};
        const reportId = shouldSaveAsReport(message, fullAnswer)
          ? await saveAssistantReport({
              websiteId,
              conversationId: activeConversationId,
              question: message,
              answer: fullAnswer,
            })
          : null;

        if (reportId) {
          assistantMessage =
            `Analiza este gata.\n\nRezumat: ${createReportSummary(fullAnswer) || "Am generat raportul complet pentru website-ul selectat."}\n\nVezi raport complet: /assistant/reports/${reportId}`;
          metadata = { reportId };
          controller.enqueue(encoder.encode(sse("report", { reportId, message: assistantMessage })));
        }

        const assistantMessageId = await persistAssistantMessage({
          conversationId: activeConversationId,
          websiteId,
          assistantMessage,
          snapshotId,
          metadata,
        });

        await recordUsageEvent({
          organizationId,
          userId,
          websiteId,
          eventType: "assistant.message",
          tokensUsed: totalTokens,
          estimatedCost: estimateChatCost(inputTokens, outputTokens),
          metadata: {
            conversation_id: activeConversationId,
            message_id: assistantMessageId,
            model: openAiConfig.model,
          },
        });

        controller.enqueue(
          encoder.encode(
            sse("done", {
              conversationId: activeConversationId,
              messageId: assistantMessageId,
            }),
          ),
        );
      } catch (error) {
        console.error("[assistant/chat] Copilot streaming failed:", error);
        controller.enqueue(
          encoder.encode(
            sse("error", {
              error: "Copilot could not generate the response. Check the AI and platform configuration.",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
