import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getLanguageName, normalizeLocale } from "@/lib/i18n/languages";
import { openAiConfig } from "@/lib/openai";

const INPUT_PRICE_PER_MILLION = 0.75;
const OUTPUT_PRICE_PER_MILLION = 4.5;

const SeoProblemSchema = z.object({
  problem: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  explanation: z.string(),
  recommendation: z.string(),
});

const FaqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const InternalLinkSchema = z.object({
  anchorText: z.string(),
  targetSuggestion: z.string(),
  reason: z.string(),
});

const SeoAnalysisSchema = z.object({
  seoScoreExplanation: z.string(),
  problems: z.array(SeoProblemSchema),
  recommendedMetaTitle: z.string(),
  recommendedMetaDescription: z.string(),
  recommendedH1: z.string(),
  recommendedFaq: z.array(FaqSchema),
  internalLinkingSuggestions: z.array(InternalLinkSchema),
  contentSuggestions: z.array(z.string()),
});

export type SeoAnalysis = z.infer<typeof SeoAnalysisSchema>;

export interface SeoPageInput {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2: string[];
  wordCount: number;
  seoScore: number;
  language?: string | null;
}

export interface SeoAgentResult {
  analysis: SeoAnalysis;
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

export async function analyzePageWithAi(page: SeoPageInput): Promise<SeoAgentResult> {
  if (!openAiConfig.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const locale = normalizeLocale(page.language);
  const outputLanguage = getLanguageName(locale);

  const openai = new OpenAI({
    apiKey: openAiConfig.apiKey,
    timeout: 60_000,
    maxRetries: 2,
  });

  const response = await openai.responses.parse({
    model: openAiConfig.model,
    input: [
      {
        role: "system",
        content:
          `You are a senior technical and editorial SEO consultant. Analyze only the provided data; do not invent statistics or existing pages. Write all user-facing output in ${outputLanguage}. Recommendations must be specific, applicable and concise. Recommended meta title: about 30-60 characters. Meta description: about 120-160 characters. FAQ: maximum 5 questions. Internal link suggestions should be written as thematic targets if concrete URLs are not known.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate complete SEO recommendations for this page.",
          page,
        }),
      },
    ],
    text: {
      format: zodTextFormat(SeoAnalysisSchema, "seo_page_analysis"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return a structured analysis.");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const totalTokens = response.usage?.total_tokens ?? inputTokens + outputTokens;

  return {
    analysis: response.output_parsed,
    model: openAiConfig.model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCost(inputTokens, outputTokens),
  };
}
