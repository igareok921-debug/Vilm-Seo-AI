"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Website } from "@/types";
import { resolveWebsiteIdentifier } from "@/lib/website-id";

const STORAGE_KEY = "vilm-active-website-id";

interface ActiveWebsiteContextValue {
  websites: Website[];
  activeWebsite: Website | null;
  activeWebsiteId: string;
  isHydrated: boolean;
  setActiveWebsiteId: (websiteId: string, syncUrl?: boolean) => void;
  hrefWithActiveWebsite: (href: string) => string;
}

const ActiveWebsiteContext = createContext<ActiveWebsiteContextValue | null>(null);

const scopedPaths = [
  "/dashboard",
  "/audit",
  "/crawl",
  "/keywords",
  "/content",
  "/assistant",
  "/reports",
  "/recommendations",
];

function pathUsesActiveWebsite(pathname: string) {
  return scopedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getInitialWebsiteId(websites: Website[]) {
  return websites[0]?.id ?? "";
}

export function ActiveWebsiteProvider({
  websites,
  children,
}: {
  websites: Website[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeWebsiteId, setActiveWebsiteIdState] = useState(getInitialWebsiteId(websites));
  const [isHydrated, setIsHydrated] = useState(false);

  const activeWebsite = useMemo(
    () => websites.find((website) => website.id === activeWebsiteId) ?? websites[0] ?? null,
    [activeWebsiteId, websites],
  );

  const replaceWebsiteInUrl = useCallback((websiteId: string) => {
    if (!pathUsesActiveWebsite(pathname)) return;

    const url = new URL(window.location.href);
    url.searchParams.set("websiteId", websiteId);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  }, [pathname, router]);

  const setActiveWebsiteId = useCallback((websiteId: string, syncUrl = true) => {
    const exists = websites.some((website) => website.id === websiteId);
    if (!exists) return;

    setActiveWebsiteIdState(websiteId);
    window.localStorage.setItem(STORAGE_KEY, websiteId);
    if (syncUrl) replaceWebsiteInUrl(websiteId);
  }, [replaceWebsiteInUrl, websites]);

  const hrefWithActiveWebsite = useCallback((href: string) => {
    if (!activeWebsiteId || !pathUsesActiveWebsite(href)) return href;

    const [path, rawQuery = ""] = href.split("?");
    const params = new URLSearchParams(rawQuery);
    params.set("websiteId", activeWebsiteId);
    return `${path}?${params.toString()}`;
  }, [activeWebsiteId]);

  useEffect(() => {
    if (websites.length === 0) {
      setIsHydrated(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryWebsiteId = params.get("websiteId");
    const storedWebsiteId = window.localStorage.getItem(STORAGE_KEY);
    const queryWebsite = resolveWebsiteIdentifier(queryWebsiteId, websites);
    const storedWebsite = resolveWebsiteIdentifier(storedWebsiteId, websites);
    const nextWebsiteId =
      queryWebsite?.id ??
      storedWebsite?.id ??
      getInitialWebsiteId(websites);

    setActiveWebsiteIdState(nextWebsiteId);
    window.localStorage.setItem(STORAGE_KEY, nextWebsiteId);
    setIsHydrated(true);

    if (pathUsesActiveWebsite(pathname) && queryWebsiteId !== nextWebsiteId) {
      const url = new URL(window.location.href);
      url.searchParams.set("websiteId", nextWebsiteId);
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
    }
  }, [pathname, router, websites]);

  const value = useMemo(
    () => ({
      websites,
      activeWebsite,
      activeWebsiteId,
      isHydrated,
      setActiveWebsiteId,
      hrefWithActiveWebsite,
    }),
    [websites, activeWebsite, activeWebsiteId, isHydrated, setActiveWebsiteId, hrefWithActiveWebsite],
  );

  return <ActiveWebsiteContext.Provider value={value}>{children}</ActiveWebsiteContext.Provider>;
}

export function useActiveWebsite() {
  const context = useContext(ActiveWebsiteContext);
  if (!context) {
    throw new Error("useActiveWebsite must be used within ActiveWebsiteProvider.");
  }

  return context;
}
