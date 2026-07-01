"use client";

import { Bell, Clock3, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { useActiveWebsite } from "@/components/active-website-provider";
import { useI18n } from "@/components/i18n-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { HeaderNotification } from "@/lib/supabase/header-notifications";

const titles: Record<string, DictionaryKey> = {
  "/dashboard": "nav.dashboard",
  "/websites": "nav.websites",
  "/websites/new": "nav.addWebsite",
  "/audit": "nav.audit",
  "/recommendations": "nav.recommendations",
  "/crawl": "nav.crawl",
  "/keywords": "nav.keywords",
  "/content": "nav.content",
  "/reports": "nav.reports",
  "/settings": "nav.settings",
};

const searchablePages: Array<{ labelKey: DictionaryKey; href: string; keywords: string }> = [
  { labelKey: "nav.dashboard", href: "/dashboard", keywords: "dashboard overview metrics" },
  { labelKey: "nav.websites", href: "/websites", keywords: "websites projects domains" },
  { labelKey: "nav.audit", href: "/audit", keywords: "audit seo issues fixes" },
  { labelKey: "nav.recommendations", href: "/recommendations", keywords: "recommendations ai priorities" },
  { labelKey: "nav.crawl", href: "/crawl", keywords: "crawl scan crawler pages" },
  { labelKey: "nav.keywords", href: "/keywords", keywords: "keywords keyword research clusters" },
  { labelKey: "nav.content", href: "/content", keywords: "content ai documents editorial plan" },
  { labelKey: "nav.assistant", href: "/assistant", keywords: "assistant copilot chat ai" },
  { labelKey: "nav.reports", href: "/reports", keywords: "reports pdf export" },
  { labelKey: "nav.settings", href: "/settings", keywords: "settings profile organization notifications" },
];

function formatNotificationTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function Header({
  user,
  notifications = [],
}: {
  user?: {
    name: string;
    email: string;
    role: string;
    organization: string;
  } | null;
  notifications?: HeaderNotification[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t } = useI18n();
  const { websites, hrefWithActiveWebsite } = useActiveWebsite();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleKey = titles[pathname];
  const title = titleKey ? t(titleKey) : "VILM SEO AI";
  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const pageResults = searchablePages.map((page) => ({
      id: page.href,
      title: t(page.labelKey),
      detail: page.keywords,
      href: hrefWithActiveWebsite(page.href),
      type: t("header.searchTypePage"),
    }));
    const websiteResults = websites.map((website) => ({
      id: website.id,
      title: website.name,
      detail: website.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: `/dashboard?websiteId=${encodeURIComponent(website.id)}`,
      type: t("header.searchTypeWebsite"),
    }));
    const results = [...pageResults, ...websiteResults];

    if (!normalizedQuery) return results.slice(0, 6);

    return results
      .filter((result) => `${result.title} ${result.detail} ${result.type}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [hrefWithActiveWebsite, query, t, websites]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openFirstResult() {
    const firstResult = searchResults[0];
    if (!firstResult) return;

    setSearchOpen(false);
    setQuery("");
    router.push(firstResult.href);
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-4 border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen(true)}
          aria-label={t("header.openMenu")}
        >
          <Menu className="size-5" />
        </Button>
        <h1 className="font-[var(--font-manrope)] text-lg font-bold tracking-tight sm:text-xl">
          {title}
        </h1>

        <div className="ml-auto hidden w-full max-w-xs items-center md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              className="h-9 bg-card pl-9"
              placeholder={t("header.search")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  openFirstResult();
                }
              }}
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘ K
            </kbd>
            {searchOpen ? (
              <div className="absolute right-0 top-11 z-50 w-[360px] overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/30">
                {searchResults.length ? (
                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {searchResults.map((result) => (
                      <Link
                        key={result.id}
                        href={result.href}
                        className="block rounded-lg px-3 py-2.5 transition hover:bg-secondary"
                        onClick={() => {
                          setSearchOpen(false);
                          setQuery("");
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium">{result.title}</span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {result.type}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{result.detail}</p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">{t("header.searchNoResults")}</div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <ThemeSwitcher />
        <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("header.notifications")}
          onClick={() => setNotificationsOpen((current) => !current)}
        >
          <Bell className="size-[18px]" />
          {notifications.length ? (
            <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-background bg-primary" />
          ) : null}
        </Button>
        {notificationsOpen ? (
          <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/30">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">{t("header.notifications")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("header.notificationsDescription")}</p>
            </div>
            {notifications.length ? (
              <div className="max-h-[380px] overflow-y-auto p-2">
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={`/dashboard?websiteId=${encodeURIComponent(notification.websiteId)}`}
                    className="block rounded-lg px-3 py-2.5 transition hover:bg-secondary"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary")}>
                        <Clock3 className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{notification.description}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {notification.websiteName} · {formatNotificationTime(notification.createdAt, locale)}
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">{t("header.notificationsEmpty")}</div>
            )}
          </div>
        ) : null}
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label={t("header.closeMenu")}
          />
          <div className="absolute inset-y-0 left-0 w-[290px] max-w-[86vw]">
            <AppSidebar mobile onClose={() => setOpen(false)} user={user} />
          </div>
        </div>
      )}
    </>
  );
}
