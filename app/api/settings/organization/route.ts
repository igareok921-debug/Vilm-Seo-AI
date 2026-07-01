import { NextResponse } from "next/server";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";

interface UpdateOrganizationBody {
  name?: unknown;
}

export async function PATCH(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  if (workspace.organization.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can update the organization." }, { status: 403 });
  }

  let body: UpdateOrganizationBody;
  try {
    body = (await request.json()) as UpdateOrganizationBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Organization name must contain between 2 and 120 characters." }, { status: 422 });
  }

  try {
    const { error } = await createAdminClient()
      .from("organizations")
      .update({ name })
      .eq("id", workspace.organization.id);

    if (error) throw error;

    return NextResponse.json({ data: { name } });
  } catch (error) {
    console.error("[settings] Organization could not be updated:", error);
    return NextResponse.json({ error: "Organization could not be saved." }, { status: 500 });
  }
}
