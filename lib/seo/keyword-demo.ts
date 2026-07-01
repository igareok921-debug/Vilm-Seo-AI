import type {
  AiContentType,
  ContentPlanItem,
  EditorialStatus,
  KeywordCluster,
  KeywordDifficulty,
  KeywordPriority,
  KeywordResearchItem,
  SearchIntent,
  Website,
} from "@/types";

const now = "2026-06-24T09:00:00Z";

const websiteKeywords: Record<
  string,
  Array<{
    keyword: string;
    intent: SearchIntent;
    difficulty: KeywordDifficulty;
    priority: KeywordPriority;
    contentType: AiContentType;
    title: string;
    description: string;
    slug: string;
  }>
> = {
  carocakes: [
    {
      keyword: "custom cakes Chisinau",
      intent: "transactional",
      difficulty: "medium",
      priority: "high",
      contentType: "landing page",
      title: "Custom Cakes in Chisinau | Caro Cakes",
      description: "Order custom cakes in Chisinau for weddings, birthdays, and private events. Premium design, refined taste, and reliable delivery.",
      slug: "custom-cakes-chisinau",
    },
    {
      keyword: "wedding cakes Chisinau",
      intent: "commercial",
      difficulty: "medium",
      priority: "high",
      contentType: "service page",
      title: "Wedding Cakes in Chisinau | Custom Design",
      description: "Elegant wedding cakes in Chisinau, made to order for memorable events. Choose the style, flavor, and decoration.",
      slug: "wedding-cakes-chisinau",
    },
    {
      keyword: "baptism cakes Chisinau",
      intent: "commercial",
      difficulty: "medium",
      priority: "high",
      contentType: "service page",
      title: "Baptism Cakes in Chisinau | Caro Cakes",
      description: "Delicate baptism cakes in Chisinau with custom decoration, soft colors, and carefully selected ingredients.",
      slug: "baptism-cakes-chisinau",
    },
    {
      keyword: "candy bar Chisinau",
      intent: "commercial",
      difficulty: "medium",
      priority: "high",
      contentType: "landing page",
      title: "Candy Bar in Chisinau for Events",
      description: "Complete candy bar for weddings, baptisms, and birthdays in Chisinau: cupcakes, macarons, cake pops, and fine desserts.",
      slug: "candy-bar-chisinau",
    },
    {
      keyword: "cupcakes Chisinau",
      intent: "transactional",
      difficulty: "low",
      priority: "medium",
      contentType: "service page",
      title: "Custom Cupcakes in Chisinau",
      description: "Fresh custom cupcakes in Chisinau for events, gifts, or candy bars.",
      slug: "cupcakes-chisinau",
    },
    {
      keyword: "macarons Chisinau",
      intent: "transactional",
      difficulty: "low",
      priority: "medium",
      contentType: "service page",
      title: "Custom Macarons in Chisinau",
      description: "Elegant, colorful, and fresh macarons for events or premium sweet gifts in Chisinau.",
      slug: "macarons-chisinau",
    },
    {
      keyword: "personalized cakes",
      intent: "commercial",
      difficulty: "medium",
      priority: "high",
      contentType: "blog article",
      title: "How to Choose a Personalized Cake for Your Event",
      description: "A practical guide to choosing a personalized cake: design, size, flavors, budget, and order timing.",
      slug: "how-to-choose-personalized-cakes",
    },
    {
      keyword: "birthday cakes",
      intent: "commercial",
      difficulty: "medium",
      priority: "medium",
      contentType: "service page",
      title: "Personalized Birthday Cakes in Chisinau",
      description: "Birthday cakes for children and adults, with creative decoration and flavors adapted to the event.",
      slug: "birthday-cakes",
    },
  ],
  vilmgroup: [
    {
      keyword: "website development Moldova",
      intent: "commercial",
      difficulty: "high",
      priority: "high",
      contentType: "landing page",
      title: "Website Development in Moldova | VILM Group",
      description: "Website development services in Moldova for companies that need modern design, SEO, and stronger conversions.",
      slug: "website-development-moldova",
    },
    {
      keyword: "website development Chisinau",
      intent: "transactional",
      difficulty: "high",
      priority: "high",
      contentType: "service page",
      title: "Website Development in Chisinau for Businesses",
      description: "We build modern websites in Chisinau: presentation websites, landing pages, e-commerce, and SEO optimization.",
      slug: "website-development-chisinau",
    },
    {
      keyword: "SMM agency Chisinau",
      intent: "commercial",
      difficulty: "medium",
      priority: "high",
      contentType: "landing page",
      title: "SMM Agency in Chisinau | Social Media Marketing",
      description: "Strategy, content, and social media management for businesses in Chisinau and Moldova.",
      slug: "smm-agency-chisinau",
    },
    {
      keyword: "Instagram management Moldova",
      intent: "commercial",
      difficulty: "medium",
      priority: "medium",
      contentType: "service page",
      title: "Instagram Management in Moldova",
      description: "Instagram management for brands: editorial plan, posts, stories, reels, and monthly reporting.",
      slug: "instagram-management-moldova",
    },
    {
      keyword: "Facebook Instagram promotion",
      intent: "commercial",
      difficulty: "medium",
      priority: "high",
      contentType: "service page",
      title: "Facebook and Instagram Promotion for Businesses",
      description: "Paid campaigns and organic content for Facebook and Instagram, focused on leads and sales.",
      slug: "facebook-instagram-promotion",
    },
    {
      keyword: "branding Moldova",
      intent: "commercial",
      difficulty: "medium",
      priority: "medium",
      contentType: "landing page",
      title: "Branding Services in Moldova",
      description: "We build consistent visual identities: brand strategy, logo, palette, fonts, and usage guidelines.",
      slug: "branding-moldova",
    },
    {
      keyword: "logo design Moldova",
      intent: "transactional",
      difficulty: "low",
      priority: "medium",
      contentType: "service page",
      title: "Logo Design in Moldova for Modern Brands",
      description: "Memorable logo design for Moldovan businesses, delivered with variants, colors, and ready-to-use files.",
      slug: "logo-design-moldova",
    },
    {
      keyword: "digital marketing Chisinau",
      intent: "commercial",
      difficulty: "high",
      priority: "high",
      contentType: "landing page",
      title: "Digital Marketing in Chisinau | VILM Group",
      description: "Integrated digital marketing services in Chisinau: websites, SMM, branding, campaigns, and SEO optimization.",
      slug: "digital-marketing-chisinau",
    },
  ],
};

function websiteKey(website: Website) {
  return website.url.includes("vilmgroup") ? "vilmgroup" : "carocakes";
}

export function getDemoKeywordResearch(website: Website): KeywordResearchItem[] {
  return websiteKeywords[websiteKey(website)].map((item, index) => ({
    id: `demo-keyword-${website.id}-${index}`,
    websiteId: website.id,
    keyword: item.keyword,
    searchIntent: item.intent,
    difficulty: item.difficulty,
    priority: item.priority,
    contentType: item.contentType,
    suggestedTitle: item.title,
    suggestedMetaDescription: item.description,
    suggestedSlug: item.slug,
    status: (index % 5 === 0 ? "drafted" : "planned") as EditorialStatus,
    createdAt: now,
  }));
}

export function getDemoKeywordClusters(website: Website): KeywordCluster[] {
  const key = websiteKey(website);
  const clusters =
    key === "vilmgroup"
      ? [
          ["Websites and SEO", "website development Moldova", ["website development Chisinau", "digital marketing Chisinau"]],
          ["Social Media", "SMM agency Chisinau", ["Instagram management Moldova", "Facebook Instagram promotion"]],
          ["Branding", "branding Moldova", ["logo design Moldova", "visual identity Moldova"]],
        ]
      : [
          ["Event cakes", "custom cakes Chisinau", ["wedding cakes Chisinau", "baptism cakes Chisinau"]],
          ["Candy bar", "candy bar Chisinau", ["cupcakes Chisinau", "macarons Chisinau"]],
          ["Personalized cakes", "personalized cakes", ["birthday cakes", "cakes for children"]],
        ];

  return clusters.map(([clusterName, mainKeyword, relatedKeywords], index) => ({
    id: `demo-cluster-${website.id}-${index}`,
    websiteId: website.id,
    clusterName: clusterName as string,
    mainKeyword: mainKeyword as string,
    relatedKeywords: relatedKeywords as string[],
    priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
    createdAt: now,
  }));
}

export function getDemoContentPlan(website: Website): ContentPlanItem[] {
  const keywords = getDemoKeywordResearch(website).slice(0, 8);

  return keywords.map((keyword, index) => ({
    id: `demo-plan-${website.id}-${index}`,
    websiteId: website.id,
    month: "2026-07",
    title: keyword.suggestedTitle,
    contentType: keyword.contentType,
    targetKeyword: keyword.keyword,
    outline: [
      `H2: Why users search for "${keyword.keyword}"`,
      "H2: Benefits and selection criteria",
      "H3: Concrete examples and recommendations",
      "H2: Recommended CTA for conversion",
    ],
    priority: keyword.priority,
    status: keyword.status,
    createdAt: now,
  }));
}
