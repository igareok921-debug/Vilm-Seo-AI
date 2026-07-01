import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { AuthFormBoundary } from "@/components/auth/auth-form-boundary";
import { getServerTranslator } from "@/lib/i18n/server";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  const { t } = await getServerTranslator();

  return (
    <AuthCardShell
      eyebrow={t("auth.loginEyebrow")}
      title={t("auth.loginTitle")}
      description={t("auth.loginDescription")}
    >
      <AuthFormBoundary mode="login" />
    </AuthCardShell>
  );
}
