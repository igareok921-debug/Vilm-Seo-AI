import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import {
  getOwnedWebsiteForCurrentUser,
  getWebsiteAccessErrorResponse,
  logSupabaseError,
  WebsiteAccessError,
} from "@/lib/supabase/website-access";

interface StatusRequest {
  issueIds?: unknown;
  websiteId?: unknown;
  action?: unknown;
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured for issue updates." },
      { status: 503 },
    );
  }

  let body: StatusRequest;
  try {
    body = (await request.json()) as StatusRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const issueIds = Array.isArray(body.issueIds)
    ? body.issueIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const action = body.action === "ignored" ? "ignored" : body.action === "resolved" ? "resolved" : null;

  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
  }

  if (issueIds.length === 0) {
    return NextResponse.json({ error: "No issues were selected." }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: "Action must be ignored or resolved." }, { status: 400 });
  }

  try {
    const { supabase } = await getOwnedWebsiteForCurrentUser(websiteId);
    const { data: issues, error: ownershipError } = await supabase
      .from("audit_issues")
      .select("id, seo_audits!inner(website_id)")
      .in("id", issueIds);

    if (ownershipError) throw ownershipError;
    const allIssuesBelongToWebsite = (issues ?? []).every((issue) => {
      const audit = issue.seo_audits as { website_id?: string } | null;
      return audit?.website_id === websiteId;
    });
    if ((issues ?? []).length !== issueIds.length || !allIssuesBelongToWebsite) {
      throw new WebsiteAccessError("One or more issues do not belong to the selected website.", 403);
    }

    const { error } = await supabase
      .from("audit_issues")
      .update({ is_resolved: true })
      .in("id", issueIds);

    if (error) throw error;

    await supabase.from("activity_logs").insert({
      website_id: websiteId,
      action: action === "ignored" ? "crawl.issue.ignored" : "crawl.issue.resolved",
      description:
        action === "ignored"
          ? `${issueIds.length} issues were ignored.`
          : `${issueIds.length} issues were marked as resolved.`,
      metadata: {
        issue_ids: issueIds,
        action,
      },
    });

    return NextResponse.json({
      data: {
        issueIds,
        status: action,
      },
    });
  } catch (error) {
    const accessError = getWebsiteAccessErrorResponse(error);
    if (accessError) return accessError;
    logSupabaseError("[crawl-issues-status] Issue update failed:", error);
    return NextResponse.json(
      { error: "Issues could not be updated." },
      { status: 500 },
    );
  }
}
