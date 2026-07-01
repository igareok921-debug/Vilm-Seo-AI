import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { AuthFormBoundary } from "@/components/auth/auth-form-boundary";
import { getServerTranslator } from "@/lib/i18n/server";

export const metadata = { title: "New password" };

export default async function ResetPasswordPage() {
  const { t } = await getServerTranslator();

  return (
    <AuthCardShell
      eyebrow={t("auth.resetEyebrow")}
      title={t("auth.resetTitle")}
      description={t("auth.resetDescription")}
    >
      <AuthFormBoundary mode="reset" />
    </AuthCardShell>
  );
}
