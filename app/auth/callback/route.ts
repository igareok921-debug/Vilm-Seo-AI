import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWebsiteIdentifier } from "@/lib/website-id";

const websiteScopedPrefixes = [
  "/dashboard",
  "/audit",
  "/crawl",
  "/keywords",
  "/content",
  "/assistant",
  "/reports",
  "/recommendations",
];

function isWebsiteScopedPath(pathname: string) {
  return websiteScopedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const targetUrl = new URL(next, requestUrl.origin);

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    if (isWebsiteScopedPath(targetUrl.pathname)) {
      const { data: websites } = await supabase
        .from("websites")
        .select("id, name, url")
        .order("created_at", { ascending: true });
      const availableWebsites = (websites ?? []) as Array<{ id: string; name: string; url: string }>;

      if (availableWebsites.length > 0) {
        const currentWebsiteId = targetUrl.searchParams.get("websiteId");
        const resolvedWebsite = resolveWebsiteIdentifier(currentWebsiteId, availableWebsites) ?? availableWebsites[0];
        targetUrl.searchParams.set("websiteId", resolvedWebsite.id);
      } else {
        targetUrl.searchParams.delete("websiteId");
      }
    }
  }

  return NextResponse.redirect(targetUrl);
}
