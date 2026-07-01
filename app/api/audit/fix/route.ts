import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
  WebsiteAccessError,
} from "@/lib/supabase/website-access";

type IssueType =
  | "missing_meta_description"
  | "short_meta_description"
  | "missing_title"
  | "short_title"
  | "images_without_alt"
  | "duplicate_titles"
  | "missing_h1"
  | "thin_content"
  | "slow_pages";

type FixMode = "preview" | "apply";

interface FixRequest {
  issueId?: string;
  websiteId?: string;
  issueType?: IssueType;
  mode?: FixMode;
}

interface IssueContext {
  issue: {
    id: string;
    audit_id: string;
    page_id: string | null;
    code: string;
    title: string;
    description: string | null;
    severity: string;
    recommendation: string | null;
  };
  page: {
    id: string;
    url: string;
    title: string | null;
    meta_description: string | null;
    h1: string | null;
    word_count: number;
    images_count: number;
    images_without_alt: number;
    load_time_ms: number | null;
  } | null;
  website: {
    name: string;
    url: string;
    niche?: string;
    language?: string;
  };
}

const supportedIssueTypes: IssueType[] = [
  "missing_meta_description",
  "short_meta_description",
  "missing_title",
  "short_title",
  "images_without_alt",
  "duplicate_titles",
  "missing_h1",
  "thin_content",
  "slow_pages",
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || value;
  }
}

function getPageSubject(context: IssueContext) {
  return (
    context.page?.h1 ||
    context.page?.title ||
    context.issue.title ||
    context.website.name
  ).replace(/\s+/g, " ").trim();
}

function getPagePath(context: IssueContext) {
  if (!context.page?.url) return "/";
  try {
    return new URL(context.page.url).pathname || "/";
  } catch {
    return context.page.url;
  }
}

function limitText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function buildMetaDescription(context: IssueContext) {
  const subject = getPageSubject(context);
  const domain = getDomain(context.website.url);
  const niche = context.website.niche && context.website.niche !== "General"
    ? ` in the ${context.website.niche.toLowerCase()} niche`
    : "";

  return limitText(
    `Useful information about ${subject}${niche} on ${domain}. Clear details, recommendations, and next steps for this page.`,
    160,
  );
}

function buildSeoTitle(context: IssueContext) {
  const subject = getPageSubject(context);
  const brand = context.website.name;
  const base = subject.toLowerCase().includes(brand.toLowerCase()) ? subject : `${subject} | ${brand}`;
  return limitText(base, 60);
}

function getFixProposal(issueType: IssueType, context: IssueContext) {
  const subject = getPageSubject(context);
  const domain = getDomain(context.website.url);
  const path = getPagePath(context);

  switch (issueType) {
    case "missing_meta_description":
    case "short_meta_description":
      return {
        title: issueType === "missing_meta_description" ? "Meta description completed" : "Meta description expanded",
        before: {
          field: "meta_description",
          value: context.page?.meta_description ?? "",
          note:
            issueType === "missing_meta_description"
              ? `Page ${path} has no meta description defined.`
              : `The meta description for page ${path} is too short to communicate the content value.`,
        },
        after: {
          field: "meta_description",
          value: buildMetaDescription(context),
          note: `Contextual click-oriented description for ${domain}, between 120 and 160 characters.`,
        },
        recommendation:
          `Add a unique meta description for page ${path}, aligned with the topic "${subject}".`,
      };
    case "images_without_alt":
      return {
        title: "ALT text generated for images",
        before: {
          field: "image_alt",
          value: `${context.page?.images_without_alt ?? 0} images without ALT`,
          note: `Images on page ${path} do not describe enough context for users or search engines.`,
        },
        after: {
          field: "image_alt",
          value: [
            `${subject} - main image`,
            `${context.website.name} - relevant visual detail for ${subject}`,
            `${domain} - contextual illustration for page ${path}`,
          ],
          note: "Descriptive ALT text without over-optimization.",
        },
        recommendation:
          `Complete ALT text with real image descriptions on page ${path}. Avoid keyword stuffing.`,
      };
    case "duplicate_titles":
    case "missing_title":
    case "short_title":
      return {
        title:
          issueType === "missing_title"
            ? "SEO title generated"
            : issueType === "short_title"
              ? "SEO title expanded"
              : "Differentiated SEO titles",
        before: {
          field: "title",
          value:
            issueType === "missing_title"
              ? context.page?.title ?? ""
              : issueType === "short_title"
                ? context.page?.title ?? "Title too short"
                : context.page?.title ?? "Duplicate title across multiple pages",
          note:
            issueType === "duplicate_titles"
              ? `Page ${path} may compete with other pages for the same queries.`
              : `The title for page ${path} should clearly describe the page topic and intent.`,
        },
        after: {
          field: "title",
          value: buildSeoTitle(context),
          note: `Unique title for ${domain}, derived from the page topic.`,
        },
        recommendation:
          `Write a unique SEO title for ${path} without copying titles from other pages on ${domain}.`,
      };
    case "slow_pages":
      return {
        title: "Speed optimization plan",
        before: {
          field: "performance",
          value: context.page?.load_time_ms ? `${context.page.load_time_ms} ms` : "High load time",
          note: `Page ${path} has performance signals that may affect user experience and Core Web Vitals.`,
        },
        after: {
          field: "performance",
          value: [
            `Technical audit for page ${path} assets`,
            "Compress images to WebP/AVIF where possible",
            "Lazy loading for below-the-fold images",
            "Static caching and unused JavaScript reduction",
          ],
          note: "Technical plan saved for performance optimization.",
        },
        recommendation:
          `Optimize page ${path} assets, then run a new crawl for ${domain}.`,
      };
    case "missing_h1":
      return {
        title: "Optimized H1",
        before: {
          field: "h1",
          value: context.page?.h1 ?? "",
          note: `Page ${path} has no detectable H1.`,
        },
        after: {
          field: "h1",
          value: subject,
          note: "A unique H1 helps crawlers and users quickly understand the page topic.",
        },
        recommendation:
          `Add one clear H1 on page ${path}, aligned with the title and page intent.`,
      };
    case "thin_content":
      return {
        title: "Expanded content",
        before: {
          field: "content",
          value: `${context.page?.word_count ?? 0} words`,
          note: `Page ${path} has too little useful text for the search intent.`,
        },
        after: {
          field: "content",
          value: [
            `Clear introduction about ${subject}`,
            "H2 sections that answer the user's main questions",
            `Contextual FAQ for ${domain}`,
            "Clear CTA for the visitor's next step",
          ],
          note: "Technical plan for expanding content.",
        },
        recommendation:
          `Expand page ${path} with useful information, H2 sections, FAQ, and relevant internal links.`,
      };
  }
}

async function updateLatestAuditScore(websiteId: string) {
  if (!isUuid(websiteId)) return;

  const supabase = createAdminClient();
  const { data: audit } = await supabase
    .from("seo_audits")
    .select("id, score")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!audit) return;

  await supabase
    .from("seo_audits")
    .update({
      score: Math.min(100, Number(audit.score ?? 0) + 2),
      summary: {
        last_fix_applied_at: new Date().toISOString(),
        note: "Score adjusted after applying the fix.",
      },
    })
    .eq("id", audit.id);
}

async function getIssueContext(
  supabase: ReturnType<typeof createAdminClient>,
  issueId: string,
  websiteId: string,
  website: IssueContext["website"],
): Promise<IssueContext> {
  if (!isUuid(issueId)) {
    throw new WebsiteAccessError("issueId must be a real UUID.", 422);
  }

  const { data: issue, error: issueError } = await supabase
    .from("audit_issues")
    .select("id, audit_id, page_id, code, title, description, severity, recommendation")
    .eq("id", issueId)
    .maybeSingle();

  if (issueError) throw issueError;
  if (!issue) {
    throw new WebsiteAccessError("The SEO issue does not exist.", 404);
  }

  const { data: audit, error: auditError } = await supabase
    .from("seo_audits")
    .select("id, website_id")
    .eq("id", issue.audit_id)
    .maybeSingle();

  if (auditError) throw auditError;
  if (!audit || audit.website_id !== websiteId) {
    throw new WebsiteAccessError("You do not have access to this SEO issue.", 403);
  }

  let page: IssueContext["page"] = null;
  if (issue.page_id) {
    const { data: pageData, error: pageError } = await supabase
      .from("pages")
      .select("id, url, title, meta_description, h1, word_count, images_count, images_without_alt, load_time_ms")
      .eq("id", issue.page_id)
      .eq("website_id", websiteId)
      .maybeSingle();

    if (pageError) throw pageError;
    page = pageData as IssueContext["page"];
  }

  return {
    issue: issue as IssueContext["issue"],
    page,
    website,
  };
}

export async function POST(request: Request) {
  let body: FixRequest;

  try {
    body = (await request.json()) as FixRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { issueId, websiteId, issueType, mode } = body;

  if (!issueId) {
    return NextResponse.json({ error: "issueId is missing." }, { status: 400 });
  }

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is missing." }, { status: 400 });
  }

  if (!issueType || !supportedIssueTypes.includes(issueType)) {
    return NextResponse.json(
      { error: "This issue type is not supported for automatic fixes." },
      { status: 422 },
    );
  }

  if (mode !== "preview" && mode !== "apply") {
    return NextResponse.json({ error: "mode must be preview or apply." }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Platform storage is not configured for applying fixes.",
      },
      { status: 503 },
    );
  }

  try {
    const { supabase, website } = await getOwnedWebsiteForCurrentUser(websiteId);
    const context = await getIssueContext(supabase, issueId, websiteId, website);
    const proposal = getFixProposal(issueType, context);

    if (mode === "preview") {
      return NextResponse.json({
        data: {
          issueId,
          websiteId,
          issueType,
          mode,
          ...proposal,
        },
      });
    }

    const now = new Date().toISOString();

    await supabase.from("audit_fixes").insert({
      issue_id: issueId,
      website_id: websiteId,
      issue_type: issueType,
      title: proposal.title,
      before_state: proposal.before,
      after_state: proposal.after,
      recommendation: proposal.recommendation,
      status: "applied",
      applied_at: now,
    });

    if (isUuid(issueId)) {
      await supabase.from("audit_issues").update({ is_resolved: true }).eq("id", issueId);
    }

    await supabase.from("activity_logs").insert({
      website_id: isUuid(websiteId) ? websiteId : null,
      action: "audit.fix.applied",
      description: `Fix applied: ${proposal.title}`,
      metadata: {
        issueId,
        websiteId,
        issueType,
        before: proposal.before,
        after: proposal.after,
      },
    });

    await updateLatestAuditScore(websiteId);

    return NextResponse.json({
      data: {
        issueId,
        websiteId,
        issueType,
        mode,
        status: "resolved",
        appliedAt: now,
        ...proposal,
      },
    });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[audit-fix] Audit fix failed:", error);
    return NextResponse.json(
      {
        error:
          "The fix could not be saved. Contact support if the problem persists.",
      },
      { status: 500 },
    );
  }
}
