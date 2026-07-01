"use client";

import {
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronDown,
  FileSearch,
  FileText,
  Globe2,
  LayoutDashboard,
  Lightbulb,
  PanelLeftClose,
  SearchCode,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useActiveWebsite } from "@/components/active-website-provider";
import { useI18n } from "@/components/i18n-provider";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.websites", href: "/websites", icon: Globe2 },
  { labelKey: "nav.audit", href: "/audit", icon: FileSearch },
  { labelKey: "nav.recommendations", href: "/recommendations", icon: Lightbulb, badge: "AI" },
  { labelKey: "nav.crawl", href: "/crawl", icon: SearchCode },
  { labelKey: "nav.keywords", href: "/keywords", icon: BarChart3 },
  { labelKey: "nav.content", href: "/content", icon: Bot, badge: "AI" },
  { labelKey: "nav.assistant", href: "/assistant", icon: BrainCircuit, badge: "AI" },
  { labelKey: "nav.reports", href: "/reports", icon: FileText },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
] as const;

export function AppSidebar({
  mobile = false,
  onClose,
  user,
}: {
  mobile?: boolean;
  onClose?: () => void;
  user?: {
    name: string;
    email: string;
    role: string;
    organization: string;
  } | null;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const {
    websites,
    activeWebsite,
    activeWebsiteId,
    isHydrated,
    setActiveWebsiteId,
    hrefWithActiveWebsite,
  } = useActiveWebsite();
  const initials = activeWebsite?.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "--";
  const domain = activeWebsite?.url.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? t("sidebar.noWebsite");
  const userInitials = (user?.name ?? user?.email ?? "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-full w-[260px] flex-col border-r bg-card/80 backdrop-blur-xl",
        mobile ? "w-full border-r-0" : "fixed inset-y-0 left-0 z-30 hidden lg:flex",
      )}
    >
      <div className="flex h-[72px] items-center justify-between border-b px-5">
        <Logo />
        {mobile ? (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("sidebar.closeMenu")}>
            <X className="size-5" />
          </Button>
        ) : (
          <PanelLeftClose className="size-4 text-muted-foreground" />
        )}
      </div>

      <div className="relative px-3 py-5">
        <button
          className="flex w-full items-center gap-3 rounded-xl border bg-background/50 p-3 text-left transition hover:bg-secondary"
          onClick={() => setSelectorOpen((open) => !open)}
          aria-expanded={selectorOpen}
          aria-label={t("sidebar.selectActiveWebsite")}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-white">
            {isHydrated ? initials : "..."}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {isHydrated ? activeWebsite?.name ?? t("sidebar.noWebsite") : t("sidebar.loading")}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{domain}</span>
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition", selectorOpen && "rotate-180")} />
        </button>
        {selectorOpen ? (
          <div className="absolute left-3 right-3 top-[92px] z-50 rounded-xl border bg-card p-2 shadow-2xl shadow-black/30">
            {!isHydrated ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t("sidebar.loadingWebsites")}</div>
            ) : websites.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t("sidebar.noWebsitesAvailable")}</div>
            ) : (
              <div className="space-y-1">
                {websites.map((website) => {
                  const websiteDomain = website.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
                  const websiteInitials = website.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const selected = website.id === activeWebsiteId;

                  return (
                    <button
                      key={website.id}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-secondary",
                        selected && "bg-primary/10 text-primary",
                      )}
                      onClick={() => {
                        setActiveWebsiteId(website.id);
                        setSelectorOpen(false);
                      }}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-[10px] font-bold text-white">
                        {websiteInitials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{website.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{websiteDomain}</span>
                      </span>
                      {selected ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-3">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {t("sidebar.workspace")}
        </p>
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={hrefWithActiveWebsite(item.href)}
              onClick={onClose}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition",
                "hover:bg-secondary hover:text-foreground",
                active && "bg-primary/10 text-primary",
              )}
            >
              <Icon className={cn("size-[18px]", active && "text-primary")} />
              <span className="flex-1">{t(item.labelKey)}</span>
              {"badge" in item && item.badge ? <Badge className="px-1.5 py-0 text-[9px]">{item.badge}</Badge> : null}
              {active && <span className="size-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <Link href={hrefWithActiveWebsite("/assistant")} onClick={onClose} className="m-3 block rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4 transition hover:border-primary/40">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <BrainCircuit className="size-4" />
          </span>
          <span className="text-sm font-semibold">VILM AI SEO Copilot</span>
        </div>
        <p className="mb-3 text-xs leading-5 text-muted-foreground">
          {t("sidebar.copilotDescription")}
        </p>
        <Button size="sm" className="w-full">{t("sidebar.open")}</Button>
      </Link>

      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-semibold text-white">
            {userInitials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user?.name ?? t("sidebar.account")}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.organization ?? user?.email ?? t("sidebar.signedIn")}</span>
          </span>
          <Button variant="ghost" size="icon" asChild aria-label="Logout">
            <Link href="/logout" onClick={onClose}>
              <LogOut className="size-4 text-muted-foreground" />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
