import { NextResponse } from "next/server";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

interface SecurityBody {
  action?: unknown;
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  let body: SecurityBody;
  try {
    body = (await request.json()) as SecurityBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  if (body.action !== "logout_all" && body.action !== "delete_account") {
    return NextResponse.json({ error: "The security action is not valid." }, { status: 422 });
  }

  try {
    if (body.action === "logout_all") {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      return NextResponse.json({ data: { signedOut: true } });
    }

    const { error } = await createAdminClient().auth.admin.deleteUser(workspace.user.id);
    if (error) throw error;
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("[settings/security] Security action failed:", error);
    return NextResponse.json({ error: "The security action could not be completed." }, { status: 500 });
  }
}
