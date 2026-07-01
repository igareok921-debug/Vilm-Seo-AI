import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  FileText,
  Mail,
  SearchCheck,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerTranslator } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/supabase/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  const { t } = await getServerTranslator();
  const platformHref = user ? "/dashboard" : "/login";
  const startHref = user ? "/dashboard" : "/register";
  const features = [
    { icon: ScanSearch, title: t("home.featureAuditTitle"), description: t("home.featureAuditDescription") },
    { icon: BarChart3, title: t("home.featureMonitoringTitle"), description: t("home.featureMonitoringDescription") },
    { icon: Bot, title: t("home.featureContentTitle"), description: t("home.featureContentDescription") },
  ];
  const benefits = [
    { icon: ShieldCheck, title: t("home.benefitIsolationTitle"), description: t("home.benefitIsolationDescription") },
    { icon: SearchCheck, title: t("home.benefitRealDataTitle"), description: t("home.benefitRealDataDescription") },
    { icon: TrendingUp, title: t("home.benefitGrowthTitle"), description: t("home.benefitGrowthDescription") },
  ];
  const modules = [
    t("home.moduleWebsites"),
    t("home.moduleCrawler"),
    t("home.moduleAudit"),
    t("home.moduleKeywords"),
    t("home.moduleContent"),
    t("home.moduleCopilot"),
    t("home.moduleReports"),
    t("home.moduleSearchConsole"),
  ];

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center px-5 lg:px-8">
          <Logo />
          <nav className="ml-12 hidden gap-7 text-sm text-muted-foreground md:flex">
            <a href="#produs" className="hover:text-foreground">{t("home.product")}</a>
            <a href="#beneficii" className="hover:text-foreground">{t("home.benefits")}</a>
            <a href="#platforma" className="hover:text-foreground">{t("home.platform")}</a>
            <a href="#contact" className="hover:text-foreground">{t("home.contact")}</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <Button variant="ghost" asChild><Link href="/login">{t("home.login")}</Link></Button>
            <Button asChild className="hidden sm:inline-flex"><Link href={platformHref}>{t("home.openPlatform")} <ArrowRight className="size-4" /></Link></Button>
          </div>
        </div>
      </header>

      <section className="grid-surface relative flex min-h-screen items-center pt-[72px]">
        <div className="absolute left-1/2 top-1/3 -z-10 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="size-3.5 text-primary" />
              {t("home.badge")}
            </div>
            <h1 className="text-balance font-[var(--font-manrope)] text-5xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              {t("home.titleStart")} <span className="bg-gradient-to-r from-violet-400 to-indigo-500 bg-clip-text text-transparent">{t("home.titleHighlight")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              {t("home.description")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild><Link href={startHref}>{t("home.startNow")} <ArrowRight className="size-4" /></Link></Button>
              <Button size="lg" variant="outline" asChild><Link href="/login">{t("home.viewDemo")}</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[t("home.noCard"), t("home.fastSetup"), t("home.centralizedData")].map((item) => (
                <span key={item} className="flex items-center gap-1.5"><Check className="size-3.5 text-success" />{item}</span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" />
            <Card className="overflow-hidden border-white/10 bg-card/85 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex gap-1.5"><span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-green-400" /></div>
                <span className="text-xs text-muted-foreground">vilmseo.ai/dashboard</span>
                <span className="size-6" />
              </div>
              <div className="p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div><p className="text-xs text-muted-foreground">{t("home.performance")}</p><p className="mt-1 text-xl font-bold">{t("home.seoScore")}</p></div>
                  <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">+6,4%</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[[t("home.websites"), "2"], [t("home.pages"), "53"], [t("home.issues"), "18"]].map(([label, value]) => (
                    <div key={label} className="rounded-xl border bg-background/40 p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-2 text-lg font-bold">{value}</p></div>
                  ))}
                </div>
                <div className="mt-4 h-40 rounded-xl border bg-gradient-to-b from-primary/10 to-transparent p-4">
                  <svg viewBox="0 0 500 120" className="h-full w-full" preserveAspectRatio="none">
                    <defs><linearGradient id="hero-chart" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cf6" stopOpacity=".4" /><stop offset="100%" stopColor="#8b7cf6" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0,100 C50,98 80,78 125,82 C180,88 190,55 250,64 C300,70 330,42 375,47 C425,52 450,20 500,25 L500,120 L0,120Z" fill="url(#hero-chart)" />
                    <path d="M0,100 C50,98 80,78 125,82 C180,88 190,55 250,64 C300,70 330,42 375,47 C425,52 450,20 500,25" fill="none" stroke="#8b7cf6" strokeWidth="3" />
                  </svg>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section id="produs" className="border-t bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{t("home.allYouNeed")}</p>
            <h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold sm:text-4xl">{t("home.commandCenter")}</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><feature.icon className="size-5" /></span>
                <h3 className="mt-5 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="beneficii" className="py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{t("home.benefitsEyebrow")}</p>
            <h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.benefitsTitle")}
            </h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              {t("home.benefitsDescription")}
            </p>
            <Button className="mt-7" asChild>
              <Link href={startHref}>{t("home.startNow")} <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <benefit.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{benefit.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{benefit.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="platforma" className="border-y bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{t("home.platformEyebrow")}</p>
              <h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight sm:text-4xl">
                {t("home.platformTitle")}
              </h2>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                {t("home.platformDescription")}
              </p>
            </div>
            <Card className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {modules.map((module) => (
                  <div key={module} className="flex items-center gap-2 rounded-xl border bg-background/40 px-3 py-2.5 text-sm">
                    <Check className="size-4 text-success" />
                    {module}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section id="contact" className="py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Card className="overflow-hidden bg-gradient-to-br from-primary/15 via-card to-card p-8 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{t("home.contactEyebrow")}</p>
                <h2 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight sm:text-4xl">
                  {t("home.contactTitle")}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  {t("home.contactDescription")}
                </p>
              </div>
              <div className="rounded-2xl border bg-background/60 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Mail className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("home.companyEmail")}</p>
                    <a className="font-semibold hover:text-primary" href="mailto:info@vilmgroup.md">
                      info@vilmgroup.md
                    </a>
                  </div>
                </div>
                <Button className="mt-5 w-full" asChild>
                  <a href="mailto:info@vilmgroup.md?subject=VILM%20SEO%20AI%20demo">
                    {t("home.contactCta")} <ArrowRight className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-xs text-muted-foreground sm:flex-row lg:px-8">
          <div className="flex items-center gap-2"><FileText className="size-4 text-primary" />VILM SEO AI</div>
          <p>© 2026 VILM Group. {t("home.rights")}</p>
        </div>
      </footer>
    </main>
  );
}
