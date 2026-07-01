import { NextResponse } from "next/server";
import { incrementReportDownload } from "@/lib/supabase/reports";
import { createClient } from "@/lib/supabase/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse, logSupabaseError } from "@/lib/supabase/website-access";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() ?? "";
  const websiteId = searchParams.get("websiteId")?.trim() ?? "";

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 422 });
  }

  try {
    const supabase = await createClient();
    let reportQuery = supabase
      .from("reports")
      .select("id, website_id, pdf_url")
      .eq("id", id)
    if (websiteId) {
      reportQuery = reportQuery.eq("website_id", websiteId);
    }

    const { data: report, error } = await reportQuery.maybeSingle();

    if (error) throw error;
    if (!report) {
      return NextResponse.json({ error: "The report was not found." }, { status: 404 });
    }

    await getOwnedWebsiteForCurrentUser(report.website_id);

    if (!report.pdf_url) {
      return NextResponse.json({ error: "The PDF is still being generated." }, { status: 409 });
    }

    await incrementReportDownload(id, report.website_id);
    return NextResponse.redirect(new URL(report.pdf_url, request.url));
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[reports/download] Report could not be downloaded:", error);
    return NextResponse.json({ error: "The report could not be downloaded." }, { status: 500 });
  }
}
