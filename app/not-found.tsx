import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerTranslator();

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><SearchX className="size-6" /></span><p className="mt-6 text-sm font-semibold text-primary">404</p><h1 className="mt-2 text-3xl font-bold">{t("notFound.title")}</h1><p className="mt-3 text-sm text-muted-foreground">{t("notFound.description")}</p><Button asChild className="mt-6"><Link href="/dashboard">{t("notFound.back")}</Link></Button></div>
    </main>
  );
}
