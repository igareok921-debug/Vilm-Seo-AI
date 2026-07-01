import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSeoIssueCopy, type SeoIssueCode } from "@/lib/seo/issue-copy";
import { createAdminClient } from "@/lib/supabase/server";

const MAX_PAGES = 500;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const CONCURRENCY = 4;
const USER_AGENT = "VILM-SEO-AI-Crawler/1.0";

export interface CrawlRequest {
  websiteId: string;
  url: string;
  maxPages?: number;
}

interface PageIssue {
  code: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "notice";
  category: string;
  recommendation: string;
}

interface PageAnalysis {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2: string[];
  canonicalUrl: string | null;
  metaRobots: string | null;
  language: string | null;
  wordCount: number;
  internalLinksCount: number;
  externalLinksCount: number;
  imagesCount: number;
  imagesWithoutAlt: number;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  twitterCard: string | null;
  hasSchemaOrg: boolean;
  loadTimeMs: number;
  isIndexable: boolean;
  seoScore: number;
  issues: PageIssue[];
  internalUrls: string[];
}

function isPrivateAddress(address: string) {
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) {
    return true;
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

export async function assertSafePublicUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The crawler accepts only HTTP or HTTPS URLs.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("Adresele locale nu pot fi scanate.");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });

  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The website points to a private network address.");
  }

  return normalizeUrl(url);
}

function normalizeUrl(value: string | URL) {
  const url = value instanceof URL ? new URL(value) : new URL(value);
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function isCrawlableUrl(url: URL) {
  return (
    ["http:", "https:"].includes(url.protocol) &&
    !/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|rar|mp4|mp3|css|js|xml|json|woff2?|ttf|ico)$/i.test(url.pathname)
  );
}

async function fetchWithRetry(url: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const startedAt = Date.now();
      let currentUrl = await assertSafePublicUrl(url);
      const initialDomain = new URL(currentUrl).hostname.replace(/^www\./, "");

      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        const response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml",
          },
          cache: "no-store",
        });

        if (response.status < 300 || response.status >= 400) {
          return { response, loadTimeMs: Date.now() - startedAt };
        }

        const location = response.headers.get("location");
        if (!location) return { response, loadTimeMs: Date.now() - startedAt };
        const nextUrl = await assertSafePublicUrl(new URL(location, currentUrl).toString());
        const nextDomain = new URL(nextUrl).hostname.replace(/^www\./, "");
        if (nextDomain !== initialDomain) {
          throw new Error("The redirect points to an external domain and was blocked.");
        }
        currentUrl = nextUrl;
      }

      throw new Error("Prea multe redirecturi.");
    } catch (error) {
      lastError = error;
      console.error(`[crawler] Error ${url}, attempt ${attempt + 1}:`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Could not access ${url}.`);
}

function cleanText(value: string | undefined) {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || null;
}

function calculateSeoScore(input: {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  imagesCount: number;
  imagesWithoutAlt: number;
  wordCount: number;
  h2Count: number;
}) {
  let score = 0;
  if (input.title) score += 20;
  if (input.metaDescription) score += 20;
  if (input.h1) score += 20;
  if (input.canonicalUrl) score += 10;
  if (input.imagesCount === 0 || input.imagesWithoutAlt === 0) score += 10;
  else score += Math.round(10 * (1 - input.imagesWithoutAlt / input.imagesCount));
  if (input.wordCount >= 300) score += 10;
  else score += Math.round((input.wordCount / 300) * 10);
  if (input.h1 && input.h2Count > 0) score += 10;
  else if (input.h1) score += 5;
  return Math.min(100, Math.max(0, score));
}

function detectIssues(input: {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  imagesWithoutAlt: number;
  wordCount: number;
}) {
  const issues: PageIssue[] = [];
  const add = (
    code: string,
    title: string,
    description: string,
    severity: PageIssue["severity"],
    recommendation: string,
  ) => issues.push({ code, title, description, severity, category: "on_page", recommendation });

  function addIssue(code: SeoIssueCode, severity: PageIssue["severity"]) {
    const copy = getSeoIssueCopy(code, {
      titleLength: input.title?.length,
      metaDescriptionLength: input.metaDescription?.length,
      imagesWithoutAlt: input.imagesWithoutAlt,
      wordCount: input.wordCount,
    });
    add(code, copy.title, copy.description, severity, copy.recommendation);
  }

  if (!input.title) addIssue("missing_title", "critical");
  else if (input.title.length < 30) addIssue("short_title", "warning");

  if (!input.metaDescription) addIssue("missing_meta_description", "warning");
  else if (input.metaDescription.length < 70) addIssue("short_meta_description", "notice");

  if (!input.h1) addIssue("missing_h1", "critical");
  if (input.imagesWithoutAlt > 0) addIssue("images_without_alt", "warning");
  if (input.wordCount < 250) addIssue("thin_content", "warning");

  return issues;
}

async function analyzePage(url: string, rootDomain: string): Promise<PageAnalysis> {
  const { response, loadTimeMs } = await fetchWithRetry(url);
  const contentType = response.headers.get("content-type") ?? "";
  const html = contentType.includes("text/html") ? await response.text() : "";
  const $ = cheerio.load(html);
  $("script, style, noscript, template, svg").remove();

  const title = cleanText($("title").first().text());
  const metaDescription = cleanText($('meta[name="description"]').attr("content"));
  const h1 = cleanText($("h1").first().text());
  const h2 = $("h2").map((_, element) => cleanText($(element).text())).get().filter((item): item is string => Boolean(item));
  const canonicalRaw = $('link[rel="canonical"]').attr("href");
  const canonicalUrl = canonicalRaw ? normalizeUrl(new URL(canonicalRaw, response.url)) : null;
  const metaRobots = cleanText($('meta[name="robots"]').attr("content"));
  const language = cleanText($("html").attr("lang"));
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const images = $("img");
  const imagesCount = images.length;
  const imagesWithoutAlt = images.filter((_, element) => !cleanText($(element).attr("alt"))).length;
  const internalUrls = new Set<string>();
  let internalLinksCount = 0;
  let externalLinksCount = 0;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    try {
      const link = new URL(href, response.url);
      if (link.hostname.replace(/^www\./, "") === rootDomain) {
        internalLinksCount += 1;
        if (isCrawlableUrl(link)) internalUrls.add(normalizeUrl(link));
      } else {
        externalLinksCount += 1;
      }
    } catch {
      // Link invalid, ignorat.
    }
  });

  const hasSchemaOrg =
    $('script[type="application/ld+json"]').length > 0 ||
    $("[itemscope], [itemtype*='schema.org'], [vocab*='schema.org']").length > 0;
  const isIndexable = !metaRobots?.toLowerCase().includes("noindex");
  const issues = detectIssues({ title, metaDescription, h1, imagesWithoutAlt, wordCount });
  const seoScore = calculateSeoScore({
    title,
    metaDescription,
    h1,
    canonicalUrl,
    imagesCount,
    imagesWithoutAlt,
    wordCount,
    h2Count: h2.length,
  });

  return {
    url: normalizeUrl(response.url || url),
    statusCode: response.status,
    title,
    metaDescription,
    h1,
    h2,
    canonicalUrl,
    metaRobots,
    language,
    wordCount,
    internalLinksCount,
    externalLinksCount,
    imagesCount,
    imagesWithoutAlt,
    openGraphTitle: cleanText($('meta[property="og:title"]').attr("content")),
    openGraphDescription: cleanText($('meta[property="og:description"]').attr("content")),
    twitterCard: cleanText($('meta[name="twitter:card"]').attr("content")),
    hasSchemaOrg,
    loadTimeMs,
    isIndexable,
    seoScore,
    issues,
    internalUrls: [...internalUrls],
  };
}

async function persistPage(
  supabase: SupabaseClient,
  websiteId: string,
  crawlId: string,
  auditId: string,
  page: PageAnalysis,
) {
  const crawledAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("pages")
    .insert({
      website_id: websiteId,
      crawl_id: crawlId,
      url: page.url,
      status_code: page.statusCode,
      title: page.title,
      meta_description: page.metaDescription,
      h1: page.h1,
      h2: page.h2,
      canonical_url: page.canonicalUrl,
      meta_robots: page.metaRobots,
      language: page.language,
      word_count: page.wordCount,
      internal_links_count: page.internalLinksCount,
      external_links_count: page.externalLinksCount,
      images_count: page.imagesCount,
      images_without_alt: page.imagesWithoutAlt,
      open_graph_title: page.openGraphTitle,
      open_graph_description: page.openGraphDescription,
      twitter_card: page.twitterCard,
      has_schema_org: page.hasSchemaOrg,
      load_time_ms: page.loadTimeMs,
      is_indexable: page.isIndexable,
      seo_score: page.seoScore,
      issues_count: page.issues.length,
      crawled_at: crawledAt,
    })
    .select("id")
    .single();

  if (error) throw error;

  if (page.issues.length) {
    const { error: issuesError } = await supabase.from("audit_issues").insert(
      page.issues.map((issue) => ({
        audit_id: auditId,
        page_id: data.id,
        ...issue,
      })),
    );
    if (issuesError) throw issuesError;
  }
}

export async function runCrawlJob(crawlId: string, request: CrawlRequest) {
  const supabase = createAdminClient();
  const maxPages = Math.min(MAX_PAGES, Math.max(1, request.maxPages ?? MAX_PAGES));
  const startUrl = await assertSafePublicUrl(request.url);
  const rootDomain = new URL(startUrl).hostname.replace(/^www\./, "");
  const queue = [startUrl];
  const queued = new Set(queue);
  const visited = new Set<string>();
  const scores: number[] = [];
  let issuesFound = 0;

  try {
    const { data: audit, error: auditError } = await supabase
      .from("seo_audits")
      .insert({ website_id: request.websiteId, crawl_id: crawlId, status: "running" })
      .select("id")
      .single();
    if (auditError) throw auditError;

    await supabase.from("crawls").update({
      status: "running",
      started_at: new Date().toISOString(),
      start_url: startUrl,
    }).eq("id", crawlId);

    while (queue.length > 0 && visited.size < maxPages) {
      const batch: string[] = [];
      while (batch.length < CONCURRENCY && queue.length > 0 && visited.size + batch.length < maxPages) {
        const currentUrl = queue.shift();
        if (currentUrl && !visited.has(currentUrl)) batch.push(currentUrl);
      }

      await Promise.all(batch.map(async (currentUrl) => {
        visited.add(currentUrl);
        try {
          const page = await analyzePage(currentUrl, rootDomain);
        await persistPage(supabase, request.websiteId, crawlId, audit.id, page);
          scores.push(page.seoScore);
          issuesFound += page.issues.length;

          for (const internalUrl of page.internalUrls) {
            if (queued.size >= maxPages || queued.has(internalUrl)) continue;
            queued.add(internalUrl);
            queue.push(internalUrl);
          }
        } catch (error) {
          console.error(`[crawler] Page ${currentUrl} failed:`, error);
        }
      }));

      const discovered = Math.min(maxPages, queued.size);
      const crawled = visited.size;
      const progress = discovered === 0 ? 0 : Math.min(99, Math.round((crawled / discovered) * 100));
      await supabase.from("crawls").update({
        pages_discovered: discovered,
        pages_crawled: crawled,
        issues_found: issuesFound,
        progress,
      }).eq("id", crawlId);
    }

    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;
    const completedAt = new Date().toISOString();

    await Promise.all([
      supabase.from("crawls").update({
        status: "completed",
        progress: 100,
        pages_discovered: queued.size,
        pages_crawled: visited.size,
        issues_found: issuesFound,
        completed_at: completedAt,
      }).eq("id", crawlId),
      supabase.from("seo_audits").update({
        status: "completed",
        score: averageScore,
        summary: { pages: visited.size, issues: issuesFound },
        completed_at: completedAt,
      }).eq("id", audit.id),
      supabase.from("websites").update({
        seo_score: averageScore,
        pages_count: visited.size,
        status: issuesFound > 0 ? "Attention" : "Active",
        last_audit_at: completedAt,
      }).eq("id", request.websiteId),
      supabase.from("activity_logs").insert({
        website_id: request.websiteId,
        action: "crawl.completed",
        description: `Crawl completed: ${visited.size} pages and ${issuesFound} issues.`,
        metadata: { crawl_id: crawlId, score: averageScore },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error(`[crawler] Crawl ${crawlId} failed:`, error);
    await supabase.from("crawls").update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    }).eq("id", crawlId);
    await supabase.from("seo_audits").update({ status: "failed" }).eq("crawl_id", crawlId);
  }
}
