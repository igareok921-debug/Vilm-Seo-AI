import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWebsites, mapWebsiteRow, type WebsiteRow } from "@/lib/supabase/websites";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import {
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
} from "@/lib/supabase/website-access";

export const runtime = "nodejs";

interface CreateWebsiteBody {
  name?: unknown;
  url?: unknown;
  language?: unknown;
  niche?: unknown;
}

interface DeleteWebsiteBody {
  websiteId?: unknown;
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

function normalizeDomainFromUrl(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

function normalizeUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Invalid protocol.");
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function validateBody(body: CreateWebsiteBody) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "";
  const niche = typeof body.niche === "string" ? body.niche.trim() : "";
  const errors: Record<string, string> = {};

  if (name.length < 2 || name.length > 120) {
    errors.name = "Name must contain between 2 and 120 characters.";
  }

  let url = "";
  try {
    url = normalizeUrl(rawUrl);
    const hostname = new URL(url).hostname;
    if (!hostname.includes(".")) {
      errors.url = "Enter a valid domain, for example example.com.";
    }
  } catch {
    errors.url = "Enter a valid URL.";
  }

  if (language.length < 2 || language.length > 10) {
    errors.language = "Select a valid language.";
  }

  if (niche.length < 2 || niche.length > 120) {
    errors.niche = "Niche must contain between 2 and 120 characters.";
  }

  return {
    data: { name, url, language, niche, normalizedDomain: url ? normalizeDomainFromUrl(url) : "" },
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

function getSupabaseErrorParts(error: unknown): SupabaseLikeError {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
  };
}

function getWebsiteCreateErrorMessage(error: unknown) {
  const { code, message, details, hint } = getSupabaseErrorParts(error);
  const raw = `${message ?? ""} ${details ?? ""} ${hint ?? ""}`.toLowerCase();

  if (code === "23505") {
    return "This domain is already associated with another account.\nIf this is your website, contact the administrator for transfer.";
  }

  if (code === "23514" && raw.includes("websites_status")) {
    return "Platform storage needs an update before this website can be saved. Contact support.";
  }

  if (code === "42703") {
    return "Platform storage is not up to date. Contact support.";
  }

  if (raw.includes("row-level security") || code === "42501") {
    return "Your account does not have permission to perform this action.";
  }

  return message
    ? `The website could not be saved: ${message}`
    : "The website could not be saved. Check the connection and try again.";
}

function extractStoragePath(pdfUrl: string) {
  const marker = "/storage/v1/object/public/reports/";
  const markerIndex = pdfUrl.indexOf(marker);
  if (markerIndex === -1) return null;

  const rawPath = pdfUrl.slice(markerIndex + marker.length).split("?")[0];
  return decodeURIComponent(rawPath);
}

function extractLocalPdfPath(pdfUrl: string) {
  if (!pdfUrl.startsWith("/reports/") || !pdfUrl.endsWith(".pdf")) return null;

  const publicDir = path.join(process.cwd(), "public");
  const fullPath = path.normalize(path.join(publicDir, pdfUrl));

  if (!fullPath.startsWith(publicDir)) return null;
  return fullPath;
}

async function deleteReportPdfFile(pdfUrl: string | null) {
  if (!pdfUrl) return;

  const storagePath = extractStoragePath(pdfUrl);
  if (storagePath) {
    const { error } = await createAdminClient().storage.from("reports").remove([storagePath]);
    if (error) {
      console.warn("[websites] Report PDF could not be deleted from Storage:", {
        message: error.message,
      });
    }
    return;
  }

  const localPath = extractLocalPdfPath(pdfUrl);
  if (!localPath) return;

  try {
    await unlink(localPath);
  } catch (error) {
    console.warn("[websites] Local report PDF could not be deleted:", error);
  }
}

async function getDeleteWebsiteId(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryWebsiteId = searchParams.get("websiteId")?.trim() ?? "";
  if (queryWebsiteId) return queryWebsiteId;

  try {
    const body = (await request.json()) as DeleteWebsiteBody;
    return typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  } catch {
    return "";
  }
}

export async function GET() {
  const workspace = await getCurrentWorkspace();
  const result = await getWebsites(workspace?.organization.id);

  return NextResponse.json({
    data: result.websites,
    source: result.source,
    warning: result.error,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Platform storage is not configured.",
      },
      { status: 503 },
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Secure server configuration is missing.",
      },
      { status: 503 },
    );
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.json(
      { error: "Your session expired. Sign in again." },
      { status: 401 },
    );
  }

  let body: CreateWebsiteBody;
  try {
    body = (await request.json()) as CreateWebsiteBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Check the submitted data.", fields: validation.errors },
      { status: 422 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data: existingWebsite, error: existingError } = await supabase
      .from("websites")
      .select("id, owner_organization_id, organization_id, normalized_domain, name, url")
      .eq("normalized_domain", validation.data.normalizedDomain)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingWebsite) {
      const currentOwner =
        existingWebsite.owner_organization_id ?? existingWebsite.organization_id;
      const isOwnedByCurrentOrganization = currentOwner === workspace.organization.id;

      return NextResponse.json(
        {
          error: isOwnedByCurrentOrganization
            ? "This domain already exists in your organization."
            : "This domain is already associated with another account.\nIf this is your website, contact the administrator for transfer.",
          duplicate: {
            websiteId: existingWebsite.id,
            domain: validation.data.normalizedDomain,
            canTransfer: workspace.profile.role === "admin" && !isOwnedByCurrentOrganization,
          },
        },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("websites")
      .insert({
        name: validation.data.name,
        url: validation.data.url,
        language: validation.data.language,
        niche: validation.data.niche,
        normalized_domain: validation.data.normalizedDomain,
        organization_id: workspace.organization.id,
        owner_organization_id: workspace.organization.id,
      })
      .select(
        "id, organization_id, owner_organization_id, normalized_domain, name, url, language, niche, seo_score, pages_count, keywords_count, status, last_audit_at, created_at",
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "This domain is already associated with another account.\nIf this is your website, contact the administrator for transfer.",
          },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json(
      { data: mapWebsiteRow(data as WebsiteRow) },
      { status: 201 },
    );
  } catch (error) {
    logSupabaseError("[websites] Website could not be added:", error);
    return NextResponse.json(
      {
        error: getWebsiteCreateErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Platform storage is not configured.",
      },
      { status: 503 },
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Secure server configuration is missing.",
      },
      { status: 503 },
    );
  }

  const websiteId = await getDeleteWebsiteId(request);
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 422 });
  }

  try {
    const { supabase } = await getOwnedWebsiteForCurrentUser(websiteId);

    const { data: reportFiles, error: reportsError } = await supabase
      .from("reports")
      .select("pdf_url")
      .eq("website_id", websiteId)
      .not("pdf_url", "is", null);
    if (reportsError) throw reportsError;

    await Promise.all(
      (reportFiles ?? []).map((report) => deleteReportPdfFile(report.pdf_url)),
    );

    await Promise.all([
      supabase.from("audit_fixes").delete().eq("website_id", websiteId),
      supabase.from("assistant_context_snapshots").delete().eq("website_id", websiteId),
      supabase.from("assistant_conversations").delete().eq("website_id", websiteId),
    ]);

    const { error } = await supabase
      .from("websites")
      .delete()
      .eq("id", websiteId);

    if (error) throw error;

    return NextResponse.json({ data: { deleted: true, websiteId } });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;

    logSupabaseError("[websites] Website could not be deleted:", error);
    return NextResponse.json(
      { error: "The website could not be deleted." },
      { status: 500 },
    );
  }
}
