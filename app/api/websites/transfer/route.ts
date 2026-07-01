import { NextResponse } from "next/server";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import { mapWebsiteRow, type WebsiteRow } from "@/lib/supabase/websites";

interface TransferBody {
  websiteId?: unknown;
  domain?: unknown;
}

function normalizeDomain(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Secure server configuration is missing." }, { status: 503 });
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  if (workspace.profile.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can transfer websites." }, { status: 403 });
  }

  let body: TransferBody;
  try {
    body = (await request.json()) as TransferBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const websiteId = typeof body.websiteId === "string" ? body.websiteId.trim() : "";
  const domainInput = typeof body.domain === "string" ? body.domain.trim() : "";
  const normalizedDomain = domainInput ? normalizeDomain(domainInput) : "";

  if (!websiteId && !normalizedDomain) {
    return NextResponse.json({ error: "websiteId or domain is required." }, { status: 422 });
  }

  try {
    const supabase = createAdminClient();
    let lookup = supabase
      .from("websites")
      .select("id, owner_organization_id, organization_id, name, url");

    lookup = websiteId
      ? lookup.eq("id", websiteId)
      : lookup.eq("normalized_domain", normalizedDomain);

    const { data: existingWebsite, error: lookupError } = await lookup.maybeSingle<{
      id: string;
      owner_organization_id: string | null;
      organization_id: string | null;
      name: string;
      url: string;
    }>();

    if (lookupError) throw lookupError;
    if (!existingWebsite) {
      return NextResponse.json({ error: "The website was not found." }, { status: 404 });
    }

    const currentOwner = existingWebsite.owner_organization_id ?? existingWebsite.organization_id;
    if (currentOwner === workspace.organization.id) {
      return NextResponse.json({ error: "The website already belongs to your organization." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("websites")
      .update({
        owner_organization_id: workspace.organization.id,
        organization_id: workspace.organization.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingWebsite.id)
      .select(
        "id, organization_id, owner_organization_id, normalized_domain, name, url, language, niche, seo_score, pages_count, keywords_count, status, last_audit_at, created_at",
      )
      .single();

    if (error) throw error;

    await supabase.from("activity_logs").insert({
      website_id: existingWebsite.id,
      action: "website.transferred",
      description: `Website ${existingWebsite.url} was transferred to organization ${workspace.organization.name}.`,
      metadata: {
        previousOwnerOrganizationId: currentOwner,
        newOwnerOrganizationId: workspace.organization.id,
      },
    });

    return NextResponse.json({ data: mapWebsiteRow(data as WebsiteRow) });
  } catch (error) {
    console.error("[websites] Website transfer failed:", error);
    return NextResponse.json({ error: "The website could not be transferred." }, { status: 500 });
  }
}
