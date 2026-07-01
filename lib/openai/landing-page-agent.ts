import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getLanguageName, normalizeLocale } from "@/lib/i18n/languages";
import { openAiConfig } from "@/lib/openai";
import type { GeneratedPageContent, Website } from "@/types";

const INPUT_PRICE_PER_MILLION = 0.75;
const OUTPUT_PRICE_PER_MILLION = 4.5;

const InternalLinkSchema = z.object({
  anchorText: z.string(),
  targetSuggestion: z.string(),
  reason: z.string(),
});

const FaqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const FaqSchemaOrgSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("FAQPage"),
  mainEntity: z
    .array(
      z.object({
        "@type": z.literal("Question"),
        name: z.string(),
        acceptedAnswer: z.object({
          "@type": z.literal("Answer"),
          text: z.string(),
        }),
      }),
    )
    .min(4)
    .max(6),
});

const SectionSchema = z.object({
  h2: z.string(),
  intro: z.string(),
  h3: z.array(z.string()).max(4),
  paragraphs: z.array(z.string()).min(1).max(3),
});

const LandingPageSchema = z.object({
  title: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  slug: z.string(),
  content: z.object({
    h1: z.string(),
    introduction: z.string(),
    sections: z.array(SectionSchema).min(5).max(8),
    faq: z.array(FaqItemSchema).min(4).max(6),
    cta: z.string(),
    internalLinks: z.array(InternalLinkSchema).min(3).max(8),
  }),
  faqSchema: FaqSchemaOrgSchema,
});

export type LandingPageAgentData = z.infer<typeof LandingPageSchema>;

export interface LandingPageAgentResult {
  data: LandingPageAgentData;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface LandingPageKeywordInput {
  keyword: string;
  suggestedTitle?: string;
  suggestedMetaDescription?: string;
  suggestedSlug?: string;
  contentType?: string;
  searchIntent?: string;
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
    timeout: 120_000,
    maxRetries: 2,
  });
}

export async function generateLandingPageWithAi(
  website: Website,
  keyword: LandingPageKeywordInput,
): Promise<LandingPageAgentResult> {
  const openai = createOpenAiClient();
  const locale = normalizeLocale(website.language);
  const outputLanguage = getLanguageName(locale);

  const response = await openai.responses.parse({
    model: openAiConfig.model,
    input: [
      {
        role: "system",
        content:
          `You are a senior SEO copywriter. Generate landing pages in ${outputLanguage}, with a clear structure, premium commercial tone and content ready for editing. Do not invent prices, guarantees, statistics or unverifiable claims. The slug must be lowercase, accent-free and hyphen-separated. Meta title: 30-60 characters. Meta description: 120-160 characters. FAQ schema must be valid JSON-LD for FAQPage.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Generate a complete SEO landing page for the selected keyword.",
          website: {
            name: website.name,
            url: website.url,
            language: locale,
            niche: website.niche ?? "General",
          },
          keyword,
          outputRequirements: [
            "SEO Title",
            "Meta Description",
            "H1",
            "Introduction",
            "5-8 H2 sections",
            "H3 where necessary",
            "FAQ with schema.org",
            "CTA",
            "slug",
            "internal linking suggestions",
          ],
        }),
      },
    ],
    text: {
      format: zodTextFormat(LandingPageSchema, "generated_landing_page"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return a structured landing page.");
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const totalTokens = response.usage?.total_tokens ?? inputTokens + outputTokens;

  return {
    data: {
      ...response.output_parsed,
      content: response.output_parsed.content as GeneratedPageContent,
    },
    model: openAiConfig.model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCost(inputTokens, outputTokens),
  };
}
