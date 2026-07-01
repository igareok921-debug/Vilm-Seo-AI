import type { Keyword, SeoIssue, Website } from "@/types";

export const websites: Website[] = [
  {
    id: "carocakes",
    name: "Caro Cakes",
    url: "https://carocakes.md",
    language: "en",
    niche: "Cake shop and custom cakes",
    score: 82,
    pages: 35,
    keywords: 12,
    status: "Active",
    lastAudit: "2026-06-13T10:30:00Z",
  },
  {
    id: "vilmgroup",
    name: "VILM Group",
    url: "https://vilmgroup.md",
    language: "en",
    niche: "Construction and B2B services",
    score: 71,
    pages: 18,
    keywords: 6,
    status: "Attention",
    lastAudit: "2026-06-12T14:15:00Z",
  },
];

export const seoIssues: SeoIssue[] = [
  {
    id: "1",
    issueId: "demo-missing-meta-carocakes",
    websiteId: "c0000000-0000-4000-8000-000000000001",
    issueType: "missing_meta_description",
    title: "Missing meta descriptions",
    website: "carocakes.md",
    severity: "Medium",
    count: 4,
    description:
      "Some important pages have no meta description. Google may generate automatic snippets, and CTR can drop.",
    recommendation:
      "Add unique 140-160 character descriptions with the main keyword and a clear reason to click.",
    status: "open",
  },
  {
    id: "2",
    issueId: "demo-alt-vilmgroup",
    websiteId: "c0000000-0000-4000-8000-000000000002",
    issueType: "images_without_alt",
    title: "Images without alternative text",
    website: "vilmgroup.md",
    severity: "Medium",
    count: 9,
    description:
      "Several images have no ALT attribute. This affects accessibility and semantic context for Google Images.",
    recommendation:
      "Add natural descriptive ALT text with the service or image context, without keyword stuffing.",
    status: "open",
  },
  {
    id: "3",
    issueId: "demo-slow-pages-vilmgroup",
    websiteId: "c0000000-0000-4000-8000-000000000002",
    issueType: "slow_pages",
    title: "Pages with high load time",
    website: "vilmgroup.md",
    severity: "Critical",
    count: 3,
    description:
      "Slow pages can reduce conversions and affect Core Web Vitals signals.",
    recommendation:
      "Compress images, enable caching, reduce unused JavaScript, and check render-blocking resources.",
    status: "open",
  },
  {
    id: "4",
    issueId: "demo-duplicate-titles-carocakes",
    websiteId: "c0000000-0000-4000-8000-000000000001",
    issueType: "duplicate_titles",
    title: "Duplicate titles",
    website: "carocakes.md",
    severity: "Low",
    count: 2,
    description:
      "Two or more pages use the same SEO title. Google may struggle to understand the difference between pages.",
    recommendation:
      "Write unique titles for each page, including the product or service type and location when relevant.",
    status: "open",
  },
];

export const keywords: Keyword[] = [
  { id: "1", term: "custom cakes", website: "carocakes.md", position: 3, change: 2, volume: 720, difficulty: 38 },
  { id: "2", term: "cake shop Chisinau", website: "carocakes.md", position: 7, change: 1, volume: 390, difficulty: 44 },
  { id: "3", term: "construction services moldova", website: "vilmgroup.md", position: 12, change: -2, volume: 260, difficulty: 53 },
  { id: "4", term: "birthday cake", website: "carocakes.md", position: 9, change: 4, volume: 880, difficulty: 47 },
  { id: "5", term: "vilm group", website: "vilmgroup.md", position: 1, change: 0, volume: 110, difficulty: 12 },
];

export const activities = [
  { title: "Audit completed for carocakes.md", detail: "SEO score increased by 3 points", time: "2 hours ago", tone: "success" },
  { title: "Crawl completed for vilmgroup.md", detail: "18 pages analyzed, 3 critical issues", time: "5 hours ago", tone: "warning" },
  { title: "Position improved", detail: "\"custom cakes\" moved up to position 3", time: "Yesterday", tone: "primary" },
  { title: "Weekly report generated", detail: "The report for June 3-9 is available", time: "Jun 10", tone: "muted" },
];
