import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getLanguageName, normalizeLocale } from "@/lib/i18n/languages";
import { openAiConfig } from "@/lib/openai";
import type { Website } from "@/types";

const INPUT_PRICE_PER_MILLION = 0.75;
const OUTPUT_PRICE_PER_MILLION = 4.5;

const SearchIntentSchema = z.enum(["informational", "commercial", "transactional", "navigational"]);
const DifficultySchema = z.enum(["low", "medium", "high"]);
const PrioritySchema = z.enum(["high", "medium", "low"]);
const ContentTypeSchema = z.enum(["landing page", "blog article", "service page", "FAQ"]);

const KeywordIdeaSchema = z.object({
  keyword: z.string(),
  secondaryKeyword: z.string(),
  longTailKeywords: z.array(z.string()).min(2).max(6),
  searchIntent: SearchIntentSchema,
  difficulty: DifficultySchema,
  priority: PrioritySchema,
  contentType: ContentTypeSchema,
  suggestedTitle: z.string(),
  suggestedMetaDescription: z.string(),
  suggestedSlug: z.string(),
});

const KeywordClusterSchema = z.object({
  clusterName: z.string(),
  mainKeyword: z.string(),
  relatedKeywords: z.array(z.string()).min(2).max(8),
  priority: PrioritySchema,
});

const KeywordResearchSchema = z.object({
  keywords: z.array(KeywordIdeaSchema).min(8).max(12),
  clusters: z.array(KeywordClusterSchema).min(3).max(6),
});

const ContentPlanSchema = z.object({
  plans: z
    .array(
      z.object({
        title: z.string(),
        contentType: ContentTypeSchema,
        targetKeyword: z.string(),
        outline: z.array(z.string()).min(4).max(8),
        recommendedCta: z.string(),
        priority: PrioritySchema,
      }),
    )
    .length(8),
});

export type KeywordAgentResearch = z.infer<typeof KeywordResearchSchema>;
export type KeywordAgentContentPlan = z.infer<typeof ContentPlanSchema>;

export interface KeywordAgentResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

function estimateCost(inputTokens: number, outputTokens: number) {
  return (
    (inputTokens / 1_000_000) * INPUT_PRICE_PER_MILLION +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION
  );
}

function createOpenAiClient() {
  if (!openAiConfig.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey: openAiConfig.apiKey,
    timeout: 90_000,
    maxRetries: 2,
  });
}

function usageResult<T>(data: T, usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null | undefined): KeywordAgentResult<T> {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

  return {
    data,
    model: openAiConfig.model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCost(inputTokens, outputTokens),
  };
}

export async function generateKeywordResearchWithAi(
  website: Website,
): Promise<KeywordAgentResult<KeywordAgentResearch>> {
  const openai = createOpenAiClient();
  const locale = normalizeLocale(website.language);
  const outputLanguage = getLanguageName(locale);

  const response = await openai.responses.parse({
    model: openAiConfig.model,
    input: [
      {
        role: "system",
        content:
          `You are a senior SEO strategist for the target market relevant to the website. Generate real, clear and actionable SEO opportunities. Write all user-facing output in ${outputLanguage}. Do not invent exact search volumes. Use only estimated difficulty: low, medium or high. Slugs must be lowercase, accent-free and hyphen-separated. Meta descriptions should be about 120-160 characters.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate keyword research and SEO clusters for this website.",
          website: {
            name: website.name,
            url: website.url,
            language: locale,
            niche: website.niche ?? "General",
          },
          businessContext:
            `Generate opportunities strictly for website ${website.name}, domain ${website.url}, niche ${website.niche ?? "General"}, output language ${outputLanguage}.`,
          rules: [
            "Do not use examples, brands or services that do not belong to the provided website.",
            "Derive keywords from the website niche, name and domain.",
            "Add one secondary keyword and long-tail keywords for each opportunity.",
            "Choose content_type from landing page, blog article, service page, FAQ.",
            "Prioritize keywords with commercial or transactional intent.",
          ],
        }),
      },
    ],
    text: {
      format: zodTextFormat(KeywordResearchSchema, "keyword_research_plan"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return structured keyword research.");
  }

  return usageResult(response.output_parsed, response.usage);
}

export async function generateContentPlanWithAi(
  website: Website,
): Promise<KeywordAgentResult<KeywordAgentContentPlan>> {
  const openai = createOpenAiClient();
  const locale = normalizeLocale(website.language);
  const outputLanguage = getLanguageName(locale);

  const response = await openai.responses.parse({
    model: openAiConfig.model,
    input: [
      {
        role: "system",
        content:
          `You are a senior SEO content strategist. Generate a 30-day editorial plan in ${outputLanguage}, with concrete ideas ready to publish. Outlines must include H2/H3 structure and a recommended CTA. Do not invent statistics.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate 8 content ideas for the next 30 days.",
          website: {
            name: website.name,
            url: website.url,
            language: locale,
            niche: website.niche ?? "General",
          },
          prompt:
            `Generate an editorial plan for website ${website.name}, domain ${website.url}, niche ${website.niche ?? "General"}, output language ${outputLanguage}.`,
          requiredOutput: [
            "title",
            "target keyword",
            "content type",
            "H2/H3 structure",
            "recommended CTA included in the outline",
            "priority",
          ],
          rules: [
            "Do not include hardcoded examples about cakes, SMM, CaroCakes or other brands unless they belong to the provided website.",
            "Every idea must be relevant to the provided website niche.",
          ],
        }),
      },
    ],
    text: {
      format: zodTextFormat(ContentPlanSchema, "content_plan_30_days"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return a structured editorial plan.");
  }

  return usageResult(response.output_parsed, response.usage);
}
