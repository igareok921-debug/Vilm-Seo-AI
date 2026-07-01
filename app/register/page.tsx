import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { AuthFormBoundary } from "@/components/auth/auth-form-boundary";
import { getServerTranslator } from "@/lib/i18n/server";

export const metadata = { title: "Register" };

export default async function RegisterPage() {
  const { t } = await getServerTranslator();

  return (
    <AuthCardShell
      eyebrow={t("auth.registerEyebrow")}
      title={t("auth.registerTitle")}
      description={t("auth.registerDescription")}
    >
      <AuthFormBoundary mode="register" />
    </AuthCardShell>
  );
}
