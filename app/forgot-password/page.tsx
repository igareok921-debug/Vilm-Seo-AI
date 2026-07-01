import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { AuthFormBoundary } from "@/components/auth/auth-form-boundary";
import { getServerTranslator } from "@/lib/i18n/server";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const { t } = await getServerTranslator();

  return (
    <AuthCardShell
      eyebrow={t("auth.forgotEyebrow")}
      title={t("auth.forgotTitle")}
      description={t("auth.forgotDescription")}
    >
      <AuthFormBoundary mode="forgot" />
    </AuthCardShell>
  );
}
