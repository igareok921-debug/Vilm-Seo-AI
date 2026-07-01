import { ArrowLeft, Check, Globe2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { WebsiteForm } from "@/components/website-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerTranslator } from "@/lib/i18n/server";
import { getCurrentWorkspace } from "@/lib/supabase/auth";

export const metadata = { title: "Add website" };

export default async function NewWebsitePage() {
  const { t } = await getServerTranslator();
  const workspace = await getCurrentWorkspace();
  const canTransferWebsites = workspace?.profile.role === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Button variant="ghost" size="sm" asChild><Link href="/websites"><ArrowLeft className="size-4" />{t("websites.back")}</Link></Button>
      <PageHeader title={t("websites.addNewTitle")} description={t("websites.addNewDescription")} />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle className="text-lg">{t("websites.detailsTitle")}</CardTitle></CardHeader>
          <CardContent>
            <WebsiteForm canTransferWebsites={canTransferWebsites} />
          </CardContent>
        </Card>
        <Card className="h-fit bg-gradient-to-br from-primary/10 to-card">
          <CardContent className="pt-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Globe2 className="size-5" /></span>
            <h3 className="mt-5 font-semibold">{t("websites.afterTitle")}</h3>
            <div className="mt-4 space-y-4">
              {[t("websites.afterAccess"), t("websites.afterDiscover"), t("websites.afterAudit"), t("websites.afterMonitoring")].map((step) => <div key={step} className="flex gap-2.5 text-sm text-muted-foreground"><Check className="mt-0.5 size-4 shrink-0 text-success" />{step}</div>)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
