import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse, logSupabaseError } from "@/lib/supabase/website-access";

export const runtime = "nodejs";

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

async function deletePdfFile(pdfUrl: string | null) {
  if (!pdfUrl) return;

  const storagePath = extractStoragePath(pdfUrl);
  if (storagePath) {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from("reports").remove([storagePath]);
    if (error) {
      throw new Error(`The PDF could not be deleted from Storage: ${error.message}`);
    }
    return;
  }

  const localPath = extractLocalPdfPath(pdfUrl);
  if (localPath) {
    try {
      await unlink(localPath);
    } catch (error) {
      console.warn("[reports] Local PDF could not be deleted:", error);
    }
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reportId = id?.trim();

  if (!reportId) {
    return NextResponse.json({ error: "reportId is required." }, { status: 422 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Platform storage is not configured for report deletion." }, { status: 503 });
  }

  let bodyWebsiteId = "";
  try {
    const body = await request.json() as { websiteId?: string };
    bodyWebsiteId = body.websiteId?.trim() ?? "";
  } catch {
    bodyWebsiteId = "";
  }

  const { searchParams } = new URL(request.url);
  const queryWebsiteId = searchParams.get("websiteId")?.trim() ?? "";
  const websiteId = bodyWebsiteId || queryWebsiteId;

  try {
    const userSupabase = await createClient();
    let reportQuery = userSupabase
      .from("reports")
      .select("id, website_id, pdf_url")
      .eq("id", reportId);
    if (websiteId) {
      reportQuery = reportQuery.eq("website_id", websiteId);
    }

    const { data: report, error: reportError } = await reportQuery.maybeSingle();
    if (reportError) throw reportError;
    if (!report) {
      return NextResponse.json({ error: "The report was not found." }, { status: 404 });
    }

    await getOwnedWebsiteForCurrentUser(report.website_id);
    await deletePdfFile(report.pdf_url);

    const query = createAdminClient()
      .from("reports")
      .delete()
      .eq("id", reportId)
      .eq("website_id", report.website_id);

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[reports] Report could not be deleted:", error);
    return NextResponse.json({ error: "The report could not be deleted." }, { status: 500 });
  }
}
