import "server-only";

import { createDemoGeneratedPage } from "@/lib/seo/generated-page-demo";
import { isDemoModeAllowed } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { containsCaroCakesLeak, isCaroCakesWebsite } from "@/lib/supabase/website-access";
import type {
  GeneratedPage,
  GeneratedPageContent,
  GeneratedPagesDataset,
  GeneratedPageStatus,
  Website,
} from "@/types";

interface GeneratedPageRow {
  id: string;
  website_id: string;
  keyword: string;
  title: string;
  meta_title: string;
  meta_description: string;
  slug: string;
  content: GeneratedPageContent;
  faq_schema: Record<string, unknown>;
  status: GeneratedPageStatus;
  created_at: string;
  updated_at: string;
}

export function mapGeneratedPageRow(row: GeneratedPageRow): GeneratedPage {
  return {
    id: row.id,
    websiteId: row.website_id,
    keyword: row.keyword,
    title: row.title,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    slug: row.slug,
    content: row.content,
    faqSchema: row.faq_schema,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getGeneratedPagesDataset(websites: Website[]): Promise<GeneratedPagesDataset> {
  if (isDemoModeAllowed()) {
    const demoPages = websites.slice(0, 2).map((website) => createDemoGeneratedPage(website));
    return { source: "demo", pages: demoPages };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("generated_pages")
      .select(
        "id, website_id, keyword, title, meta_title, meta_description, slug, content, faq_schema, status, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const websiteLookup = new Map(websites.map((website) => [website.id, website]));
    const pages = (data as GeneratedPageRow[])
      .filter((row) => {
        const website = websiteLookup.get(row.website_id);
        return !website || isCaroCakesWebsite(website) || !containsCaroCakesLeak(row);
      })
      .map(mapGeneratedPageRow);

    return { source: "supabase", pages };
  } catch (error) {
    console.error("Generated pages could not be loaded:", error);
    return {
      source: "supabase",
      pages: [],
      error: "Generated pages could not be loaded.",
    };
  }
}
