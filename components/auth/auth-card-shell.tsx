"use client";

import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

export function AuthCardShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const points = [
    t("auth.heroPointAudit"),
    t("auth.heroPointMonitoring"),
    t("auth.heroPointAi"),
  ];

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r bg-card lg:flex lg:flex-col">
        <div className="grid-surface absolute inset-0 opacity-60" />
        <div className="absolute left-1/3 top-1/3 size-[500px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="relative z-10 p-10"><Logo /></div>
        <div className="relative z-10 my-auto max-w-xl px-10 pb-24 xl:px-20">
          <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20">
            <Sparkles className="size-5" />
          </span>
          <h1 className="text-balance font-[var(--font-manrope)] text-4xl font-bold leading-tight xl:text-5xl">
            {t("auth.heroTitle")}
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            {t("auth.heroDescription")}
          </p>
          <div className="mt-8 space-y-3">
            {points.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm">
                <span className="flex size-6 items-center justify-center rounded-full bg-success/10 text-success">
                  <Check className="size-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-5 py-16">
        <div className="absolute right-5 top-5 flex items-center gap-2">
          <Button variant="ghost" asChild><Link href="/">{t("auth.home")}</Link></Button>
          <ThemeSwitcher />
        </div>
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
          <h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
