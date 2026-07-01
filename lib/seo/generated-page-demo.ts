import type { GeneratedPage, Website } from "@/types";

export function createDemoGeneratedPage(website: Website, keyword = "custom cakes Chisinau"): GeneratedPage {
  const isVilm = website.url.includes("vilmgroup");
  const targetKeyword = isVilm ? "website development Moldova" : keyword;
  const title = isVilm
    ? "Website Development in Moldova for Modern Businesses"
    : "Custom Cakes in Chisinau for Special Events";
  const slug = isVilm ? "website-development-moldova" : "custom-cakes-chisinau";

  const faq = isVilm
    ? [
        {
          question: "How long does it take to build a website?",
          answer: "Timeline depends on complexity, content, and required features, but a presentation website can be planned in clear stages.",
        },
        {
          question: "Can the website be optimized for SEO?",
          answer: "Yes. Page structure, titles, meta descriptions, and content can be prepared for indexing and conversions.",
        },
      ]
    : [
        {
          question: "How early should I order a custom cake?",
          answer: "For custom cakes, it is best to order early, especially for weddings, baptisms, or larger events.",
        },
        {
          question: "Can I choose the cake design and flavor?",
          answer: "Yes. The cake can be adapted to the event theme, flavor preferences, and desired visual style.",
        },
      ];

  return {
    id: `demo-generated-${website.id}`,
    websiteId: website.id,
    keyword: targetKeyword,
    title,
    metaTitle: title,
    metaDescription: isVilm
      ? "Website development services in Moldova for companies that need modern design, SEO structure, and a professional digital presence."
      : "Order custom cakes in Chisinau for weddings, baptisms, or birthdays. Premium design, refined taste, and event-ready decoration.",
    slug,
    status: "draft",
    createdAt: "2026-06-25T09:00:00Z",
    updatedAt: "2026-06-25T09:00:00Z",
    content: {
      h1: title,
      introduction: isVilm
        ? "A professional website is the foundation of a digital presence that builds trust and converts visitors into clients."
        : "A custom cake turns an event into a memorable experience through design, taste, and attention to detail.",
      sections: [
        {
          h2: isVilm ? "Why You Need a Professional Website" : "Why Choose a Custom Cake",
          intro: "This section explains the main benefits for the client.",
          h3: ["Custom design", "Clear user experience"],
          paragraphs: [
            isVilm
              ? "A well-built website quickly communicates who you are, what you offer, and why clients should choose you."
              : "A custom cake is created around the event, theme, and guest preferences.",
          ],
        },
        {
          h2: "How the Process Works",
          intro: "The steps help users quickly understand how collaboration starts.",
          h3: ["Consultation", "Planning", "Delivery"],
          paragraphs: ["Everything starts with a discussion about goals, preferences, and important details."],
        },
        {
          h2: "What You Receive",
          intro: "A description of concrete benefits.",
          h3: ["Tailored solution", "Promotion-ready result"],
          paragraphs: ["The final result is built for real users and business goals."],
        },
        {
          h2: "Who This Is For",
          intro: "Audience segmentation.",
          h3: [],
          paragraphs: ["The page speaks to clients looking for quality, clarity, and a professional result."],
        },
        {
          h2: "How to Start",
          intro: "Conversion-oriented encouragement.",
          h3: [],
          paragraphs: ["Send a request with your project details and receive the next planning steps."],
        },
      ],
      faq,
      cta: isVilm ? "Request a website consultation" : "Order the cake for your event",
      internalLinks: [
        {
          anchorText: isVilm ? "branding services" : "wedding cakes",
          targetSuggestion: isVilm ? "/branding-moldova" : "/wedding-cakes-chisinau",
          reason: "Connects this page with related commercial services.",
        },
      ],
    },
    faqSchema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  };
}
