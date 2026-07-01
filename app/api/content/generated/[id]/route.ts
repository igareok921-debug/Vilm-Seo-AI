import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { mapGeneratedPageRow } from "@/lib/supabase/generated-pages";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";
import type { GeneratedPageContent, GeneratedPageStatus } from "@/types";

interface UpdateGeneratedPageBody {
  title?: unknown;
  metaTitle?: unknown;
  metaDescription?: unknown;
  slug?: unknown;
  status?: unknown;
  content?: unknown;
  faqSchema?: unknown;
}

const allowedStatuses: GeneratedPageStatus[] = ["draft", "review", "approved", "published"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured for saving edits." },
      { status: 503 },
    );
  }

  const { id } = await params;

  let body: UpdateGeneratedPageBody;
  try {
    body = (await request.json()) as UpdateGeneratedPageBody;
  } catch {
    return NextResponse.json(
      { error: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};

  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.metaTitle === "string") update.meta_title = body.metaTitle.trim();
  if (typeof body.metaDescription === "string") update.meta_description = body.metaDescription.trim();
  if (typeof body.slug === "string") update.slug = body.slug.trim();
  if (body.content && typeof body.content === "object") update.content = body.content as GeneratedPageContent;
  if (body.faqSchema && typeof body.faqSchema === "object") {
    update.faq_schema = body.faqSchema as Record<string, unknown>;
  }
  if (typeof body.status === "string" && allowedStatuses.includes(body.status as GeneratedPageStatus)) {
    update.status = body.status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "There are no valid fields to update." }, { status: 422 });
  }

  try {
    const userSupabase = await createClient();
    const { data: existing, error: existingError } = await userSupabase
      .from("generated_pages")
      .select("id, website_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ error: "The generated page does not exist." }, { status: 404 });
    }

    await getOwnedWebsiteForCurrentUser(existing.website_id);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("generated_pages")
      .update(update)
      .eq("id", id)
      .eq("website_id", existing.website_id)
      .select(
        "id, website_id, keyword, title, meta_title, meta_description, slug, content, faq_schema, status, created_at, updated_at",
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: {
        page: mapGeneratedPageRow(data),
      },
    });
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;

    console.error("[api/content/generated/:id] Generated page save failed:", error);

    return NextResponse.json(
      { error: "The generated page could not be saved." },
      { status: 500 },
    );
  }
}
