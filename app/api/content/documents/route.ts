import { NextResponse } from "next/server";
import OpenAI from "openai";
import { DEFAULT_LOCALE, getLanguageName, normalizeLocale } from "@/lib/i18n/languages";
import { isOpenAiConfigured, openAiConfig } from "@/lib/openai";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { mapAiDocumentRow } from "@/lib/supabase/ai-documents";
import {
  assertNoDemoContentLeak,
  cleanupDemoContentForWebsite,
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
} from "@/lib/supabase/website-access";
import { checkUsageLimit, getUsageLimitErrorResponse, recordUsageEvent } from "@/lib/usage/check-limits";
import type { AiDocumentTone, AiDocumentType } from "@/types";

export const maxDuration = 180;

const documentTypes: AiDocumentType[] = [
  "seo_article",
  "landing_page",
  "meta_tags",
  "faq",
  "text_optimization",
  "content_ideas",
];

const tones: AiDocumentTone[] = ["profesional", "prietenos", "premium", "comercial"];

interface DocumentBody {
  websiteId?: unknown;
  type?: unknown;
  keyword?: unknown;
  title?: unknown;
  language?: unknown;
  tone?: unknown;
  instructions?: unknown;
}

function isDocumentType(value: unknown): value is AiDocumentType {
  return typeof value === "string" && documentTypes.includes(value as AiDocumentType);
}

function isTone(value: unknown): value is AiDocumentTone {
  return typeof value === "string" && tones.includes(value as AiDocumentTone);
}

function typeLabel(type: AiDocumentType) {
  const labels: Record<AiDocumentType, string> = {
    seo_article: "SEO article",
    landing_page: "Landing Page",
    meta_tags: "Meta Title / Meta Description",
    faq: "FAQ",
    text_optimization: "Existing text optimization",
    content_ideas: "Content ideas",
  };

  return labels[type];
}

function estimateDocumentCost(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.6;
}

async function generateDocumentContent(input: {
  website: { name: string; url: string; language: string | null; niche: string | null };
  type: AiDocumentType;
  keyword: string;
  title: string;
  language: string;
  tone: AiDocumentTone;
  instructions: string;
}) {
  const outputLanguage = getLanguageName(input.language);
  const openai = new OpenAI({
    apiKey: openAiConfig.apiKey,
    timeout: 120_000,
    maxRetries: 2,
  });

  const response = await openai.responses.create({
    model: openAiConfig.model,
    input: [
      {
        role: "system",
        content:
          `You are a senior SEO copywriter. Write exclusively in ${outputLanguage}, clearly, commercially and structurally. Do not invent statistics. Return Markdown content ready for editing.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate an AI SEO document.",
          documentType: typeLabel(input.type),
          website: input.website,
          keyword: input.keyword,
          title: input.title,
          language: input.language,
          tone: input.tone,
          instructions: input.instructions,
          requirements: [
            "Include H1/H2/H3 structure where relevant.",
            "Include a clear CTA.",
            "For FAQ, include concise questions and answers.",
            "For meta tags, provide at least 5 title and description variants.",
            "For text optimization, provide an improved version and explanations.",
          ],
        }),
      },
    ],
  });

  const markdown = response.output_text?.trim();
  if (!markdown) {
    throw new Error("OpenAI did not return document content.");
  }

  return {
    markdown,
    model: openAiConfig.model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
    estimatedCostUsd: estimateDocumentCost(
      response.usage?.input_tokens ?? 0,
      response.usage?.output_tokens ?? 0,
    ),
    generatedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured. The document cannot be saved." },
      { status: 503 },
    );
  }

  if (!isOpenAiConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured. The AI document cannot be generated." },
      { status: 503 },
    );
  }

  let body: DocumentBody;
  try {
    body = (await request.json()) as DocumentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const type = isDocumentType(body.type) ? body.type : null;
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const language = normalizeLocale(typeof body.language === "string" ? body.language : DEFAULT_LOCALE);
  const tone = isTone(body.tone) ? body.tone : "profesional";
  const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";

  if (!websiteId || !type || !title) {
    return NextResponse.json(
      { error: "websiteId, type, and title are required." },
      { status: 422 },
    );
  }

  try {
    const access = await getOwnedWebsiteForCurrentUser(websiteId);
    const { supabase, website, organizationId, workspace } = access;
    await cleanupDemoContentForWebsite(access);

    await checkUsageLimit({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "content.document",
    });

    const content = await generateDocumentContent({
      website: {
        name: website.name,
        url: website.url,
        language: website.language ?? DEFAULT_LOCALE,
        niche: website.niche ?? "General",
      },
      type,
      keyword,
      title,
      language,
      tone,
      instructions,
    });
    assertNoDemoContentLeak(website, content);

    const { data, error } = await supabase
      .from("ai_documents")
      .insert({
        organization_id: organizationId,
        website_id: websiteId,
        type,
        keyword: keyword || null,
        title,
        content,
        status: "draft",
        language,
        tone,
      })
      .select("id, website_id, type, keyword, title, content, status, language, tone, created_at, updated_at")
      .single();

    if (error) throw error;

    await supabase.from("activity_logs").insert({
      website_id: websiteId,
      action: "ai.document.created",
      description: `AI document created: ${title}`,
      metadata: {
        document_id: data.id,
        type,
        keyword,
        model: openAiConfig.model,
      },
    });

    await recordUsageEvent({
      organizationId,
      userId: workspace.user.id,
      websiteId,
      eventType: "content.document",
      tokensUsed: content.totalTokens,
      estimatedCost: content.estimatedCostUsd,
      metadata: {
        document_id: data.id,
        type,
        keyword,
        model: content.model,
      },
    });

    return NextResponse.json({
      source: "supabase",
      data: {
        document: mapAiDocumentRow(data),
      },
    });
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;
    const usageError = getUsageLimitErrorResponse(error);
    if (usageError) return usageError;

    console.error("[api/content/documents] AI document could not be generated:", error);
    return NextResponse.json(
      { error: "The AI document could not be generated or saved. Check the AI and platform configuration." },
      { status: 500 },
    );
  }
}
