"use client";

import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { useI18n } from "@/components/i18n-provider";

export function AuthFormBoundary({ mode }: { mode: "login" | "register" | "forgot" | "reset" }) {
  const { t } = useI18n();

  return (
    <Suspense fallback={<div className="mt-8 rounded-xl border bg-card p-4 text-sm text-muted-foreground">{t("auth.loadingForm")}</div>}>
      <AuthForm mode={mode} />
    </Suspense>
  );
}
