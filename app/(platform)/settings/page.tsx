import { PageHeader } from "@/components/page-header";
import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { getServerTranslator } from "@/lib/i18n/server";
import { getSettingsPageData } from "@/lib/supabase/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ websiteId?: string }>;
}) {
  const params = await searchParams;
  const [{ t }, settingsData] = await Promise.all([
    getServerTranslator(),
    getSettingsPageData(params),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />
      {settingsData ? (
        <SettingsPageClient data={settingsData} />
      ) : (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {t("settings.loadFailed")}
        </div>
      )}
    </div>
  );
}
