import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveWebsiteIdentifier } from "@/lib/website-id";

const protectedPrefixes = [
  "/dashboard",
  "/websites",
  "/audit",
  "/crawl",
  "/keywords",
  "/content",
  "/assistant",
  "/reports",
  "/settings",
  "/recommendations",
];

const authPages = ["/login", "/register"];
const publicApiPrefixes = ["/api/search-console/callback"];
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

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedApiPath(pathname: string) {
  return pathname.startsWith("/api/") && !publicApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isWebsiteScopedPath(pathname: string) {
  return websiteScopedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user && isProtectedApiPath(pathname)) {
    return NextResponse.json({ error: "Autentificarea este obligatorie." }, { status: 401 });
  }

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && authPages.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isWebsiteScopedPath(pathname)) {
    const { data: websites } = await supabase
      .from("websites")
      .select("id, name, url")
      .order("created_at", { ascending: true });
    const availableWebsites = (websites ?? []) as Array<{ id: string; name: string; url: string }>;
    const currentWebsiteId = request.nextUrl.searchParams.get("websiteId");

    if (availableWebsites.length === 0 && currentWebsiteId) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.searchParams.delete("websiteId");
      return NextResponse.redirect(redirectUrl);
    }

    if (availableWebsites.length > 0) {
      const resolvedWebsite = resolveWebsiteIdentifier(currentWebsiteId, availableWebsites) ?? availableWebsites[0];
      if (currentWebsiteId !== resolvedWebsite.id) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.searchParams.set("websiteId", resolvedWebsite.id);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)",
  ],
};
