import { AppSidebar } from "@/components/app-sidebar";
import { ActiveWebsiteProvider } from "@/components/active-website-provider";
import { Header } from "@/components/header";
import { I18nProvider } from "@/components/i18n-provider";
import { getCurrentAppLocale } from "@/lib/i18n/server";
import { getCurrentWorkspace } from "@/lib/supabase/auth";
import { getHeaderNotifications } from "@/lib/supabase/header-notifications";
import { getWebsites } from "@/lib/supabase/websites";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getCurrentWorkspace();
  const appLocale = await getCurrentAppLocale();
  const { websites } = await getWebsites(workspace?.organization.id);
  const notifications = await getHeaderNotifications(websites.map((website) => ({
    id: website.id,
    name: website.name,
  })));
  const userSummary = workspace ? {
    name: workspace.profile.fullName,
    email: workspace.profile.email,
    role: workspace.organization.role,
    organization: workspace.organization.name,
  } : null;

  return (
    <I18nProvider initialLocale={appLocale}>
      <ActiveWebsiteProvider websites={websites}>
        <div className="min-h-screen bg-background">
          <AppSidebar user={userSummary} />
          <div className="lg:pl-[260px]">
            <Header user={userSummary} notifications={notifications} />
            <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </ActiveWebsiteProvider>
    </I18nProvider>
  );
}
