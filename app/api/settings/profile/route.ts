import { NextResponse } from "next/server";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";

interface UpdateProfileBody {
  fullName?: unknown;
}

export async function PATCH(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  let body: UpdateProfileBody;
  try {
    body = (await request.json()) as UpdateProfileBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: "Name must contain between 2 and 120 characters." }, { status: 422 });
  }

  try {
    const supabase = createAdminClient();
    const profileResult = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", workspace.user.id);

    if (profileResult.error) throw profileResult.error;

    return NextResponse.json({
      data: {
        fullName,
      },
    });
  } catch (error) {
    console.error("[settings] Profile could not be updated:", error);
    return NextResponse.json({ error: "Settings could not be saved." }, { status: 500 });
  }
}
