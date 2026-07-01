export type WebsiteStatus = "Active" | "Attention" | "Analyzing" | "Activ" | "Atenție" | "Se analizează";

export interface Website {
  id: string;
  name: string;
  url: string;
  language?: string;
  niche?: string;
  score: number;
  pages: number;
  keywords: number;
  status: WebsiteStatus;
  lastAudit: string;
}

export interface SeoIssue {
  id: string;
  issueId: string;
  websiteId: string;
  issueType:
    | "missing_meta_description"
    | "short_meta_description"
    | "missing_title"
    | "short_title"
    | "images_without_alt"
    | "duplicate_titles"
    | "missing_h1"
    | "thin_content"
    | "slow_pages";
  title: string;
  website: string;
  severity: "Critical" | "Medium" | "Low" | "Critică" | "Medie" | "Redusă";
  count: number;
  description: string;
  recommendation: string;
  impact?: string;
  status?: "open" | "resolved";
}

export interface Keyword {
  id: string;
  term: string;
  website: string;
  position: number;
  change: number;
  volume: number;
  difficulty: number;
}

export type CrawlStatus = "pending" | "running" | "completed" | "failed";

export interface CrawlProgress {
  id: string;
  websiteId: string;
  status: CrawlStatus;
  startUrl: string;
  pagesDiscovered: number;
  pagesCrawled: number;
  issuesFound: number;
  progress: number;
  errorMessage: string | null;
}

export interface CrawledPage {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2: string[];
  wordCount: number;
  seoScore: number;
  issuesCount: number;
  crawledAt: string | null;
}

export type AiPriority = "high" | "medium" | "low";

export interface AiSeoProblem {
  problem: string;
  priority: AiPriority;
  explanation: string;
  recommendation: string;
}

export interface AiFaqItem {
  question: string;
  answer: string;
}

export interface AiInternalLinkSuggestion {
  anchorText: string;
  targetSuggestion: string;
  reason: string;
}

export interface AiRecommendation {
  id: string;
  pageId: string;
  pageUrl: string;
  model: string;
  seoScoreExplanation: string;
  problems: AiSeoProblem[];
  recommendedMetaTitle: string;
  recommendedMetaDescription: string;
  recommendedH1: string;
  recommendedFaq: AiFaqItem[];
  internalLinkingSuggestions: AiInternalLinkSuggestion[];
  contentSuggestions: string[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface SearchConsoleMetricRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleDecliningPage {
  key: string;
  clicks: number;
  previousClicks: number;
  clickChange: number;
  impressions: number;
  position: number;
}

export interface SearchConsoleOpportunity extends SearchConsoleMetricRow {
  reason: string;
}

export interface SearchConsoleDashboardData {
  source: "google" | "demo" | "empty";
  connected: boolean;
  property: string | null;
  period: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topQueries: SearchConsoleMetricRow[];
  topPages: SearchConsoleMetricRow[];
  decliningPages: SearchConsoleDecliningPage[];
  opportunities: SearchConsoleOpportunity[];
  error?: string;
}

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational";
export type KeywordDifficulty = "low" | "medium" | "high";
export type KeywordPriority = "high" | "medium" | "low";
export type AiContentType = "landing page" | "blog article" | "service page" | "FAQ";
export type EditorialStatus = "planned" | "drafted" | "published" | "indexed";

export interface KeywordResearchItem {
  id: string;
  websiteId: string;
  keyword: string;
  searchIntent: SearchIntent;
  difficulty: KeywordDifficulty;
  priority: KeywordPriority;
  contentType: AiContentType;
  suggestedTitle: string;
  suggestedMetaDescription: string;
  suggestedSlug: string;
  status: EditorialStatus;
  createdAt: string;
}

export interface KeywordCluster {
  id: string;
  websiteId: string;
  clusterName: string;
  mainKeyword: string;
  relatedKeywords: string[];
  priority: KeywordPriority;
  createdAt: string;
}

export interface ContentPlanItem {
  id: string;
  websiteId: string;
  month: string;
  title: string;
  contentType: AiContentType;
  targetKeyword: string;
  outline: string[];
  priority: KeywordPriority;
  status: EditorialStatus;
  createdAt: string;
}

export interface KeywordResearchDataset {
  source: "supabase" | "demo";
  keywords: KeywordResearchItem[];
  clusters: KeywordCluster[];
  generatedPages?: Record<string, { id: string; status: GeneratedPageStatus }>;
  error?: string;
}

export interface ContentPlanDataset {
  source: "supabase" | "demo";
  plans: ContentPlanItem[];
  error?: string;
}

export type AiDocumentType =
  | "seo_article"
  | "landing_page"
  | "meta_tags"
  | "faq"
  | "text_optimization"
  | "content_ideas";

export type AiDocumentTone = "profesional" | "prietenos" | "premium" | "comercial";
export type AiDocumentStatus = "draft" | "review" | "published";

export interface AiDocument {
  id: string;
  websiteId: string;
  type: AiDocumentType;
  keyword: string | null;
  title: string;
  content: {
    markdown?: string;
    sections?: string[];
    [key: string]: unknown;
  };
  status: AiDocumentStatus;
  language: string;
  tone: AiDocumentTone;
  createdAt: string;
  updatedAt: string;
}

export interface AiDocumentsDataset {
  source: "supabase" | "demo";
  documents: AiDocument[];
  error?: string;
}

export type GeneratedPageStatus = "draft" | "review" | "approved" | "published";

export interface GeneratedPageSection {
  h2: string;
  intro: string;
  h3: string[];
  paragraphs: string[];
}

export interface GeneratedPageFaqItem {
  question: string;
  answer: string;
}

export interface GeneratedPageInternalLink {
  anchorText: string;
  targetSuggestion: string;
  reason: string;
}

export interface GeneratedPageContent {
  h1: string;
  introduction: string;
  sections: GeneratedPageSection[];
  faq: GeneratedPageFaqItem[];
  cta: string;
  internalLinks: GeneratedPageInternalLink[];
}

export interface GeneratedPage {
  id: string;
  websiteId: string;
  keyword: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  content: GeneratedPageContent;
  faqSchema: Record<string, unknown>;
  status: GeneratedPageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedPagesDataset {
  source: "supabase" | "demo";
  pages: GeneratedPage[];
  error?: string;
}

export interface AssistantConversation {
  id: string;
  websiteId: string | null;
  title: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  websiteId: string | null;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AssistantReport {
  id: string;
  websiteId: string;
  conversationId: string | null;
  title: string;
  summary: string;
  report: string;
  type: string;
  createdAt: string;
}

export type SeoReportStatus = "generating" | "ready" | "failed";

export interface SeoReport {
  id: string;
  websiteId: string;
  title: string;
  type: string;
  status: SeoReportStatus;
  periodStart: string;
  periodEnd: string;
  summary: string | null;
  data: Record<string, unknown>;
  pdfUrl: string | null;
  downloadsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantContextSnapshot {
  website: Website | null;
  seoScore: number | null;
  pagesIndexed: number;
  pagesNotIndexed: number;
  primaryKeyword: string | null;
  lastCrawl: {
    status: string;
    pagesCrawled: number;
    issuesFound: number;
    createdAt: string;
  } | null;
  lastAudit: {
    score: number;
    status: string;
    completedAt: string | null;
  } | null;
  crawl: {
    pages: CrawledPage[];
    issues: Array<{
      id: string;
      title: string;
      description: string | null;
      severity: "critical" | "warning" | "notice";
      recommendation: string | null;
      pageUrl: string | null;
    }>;
  };
  keywords: KeywordResearchItem[];
  generatedPages: GeneratedPage[];
  recommendations: AiRecommendation[];
  searchConsole: SearchConsoleDashboardData | null;
  analytics: null;
  activityLogs: Array<{
    action: string;
    description: string | null;
    createdAt: string;
  }>;
  contextFlags: {
    crawl: boolean;
    searchConsole: boolean;
    keywords: boolean;
    aiContent: boolean;
    auditSeo: boolean;
    generatedPages: boolean;
    recommendations: boolean;
    analytics: boolean;
  };
}
