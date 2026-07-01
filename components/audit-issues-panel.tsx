"use client";

import { CheckCircle2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { SeoIssue } from "@/types";

interface AuditIssuesPanelProps {
  issues: SeoIssue[];
}

function getSeverityVariant(severity: SeoIssue["severity"]) {
  if (severity === "Critical" || severity === "Critică") return "destructive";
  if (severity === "Medium" || severity === "Medie") return "warning";
  return "outline";
}

function getIssueIconClass(severity: SeoIssue["severity"], resolved: boolean) {
  if (resolved) return "bg-success/10 text-success";
  if (severity === "Critical" || severity === "Critică") return "bg-destructive/10 text-destructive";
  if (severity === "Medium" || severity === "Medie") return "bg-warning/10 text-warning";
  return "bg-secondary text-muted-foreground";
}

export function AuditIssuesPanel({ issues }: AuditIssuesPanelProps) {
  const { t } = useI18n();

  function getSeverityLabel(severity: SeoIssue["severity"]) {
    if (severity === "Critical" || severity === "Critică") return t("audit.severityCritical");
    if (severity === "Medium" || severity === "Medie") return t("audit.severityMedium");
    return t("audit.severityLow");
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        {t("audit.noIssues")}
      </div>
    );
  }

  return (
    <>
      <div className="divide-y">
        {issues.map((issue) => {
          const resolved = issue.status === "resolved";

          return (
            <div
              key={issue.issueId}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  getIssueIconClass(issue.severity, resolved),
                )}
              >
                {resolved ? <CheckCircle2 className="size-4" /> : <Wrench className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{issue.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {issue.website} · {issue.count} {t("audit.occurrences")} · {issue.issueType}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("audit.estimatedImpact")}: {issue.impact ?? t("audit.defaultImpact")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={resolved ? "success" : getSeverityVariant(issue.severity)}>
                  {resolved ? t("audit.fixed") : getSeverityLabel(issue.severity)}
                </Badge>
                <Button
                  variant={resolved ? "secondary" : "ghost"}
                  size="sm"
                  disabled
                  title={resolved ? t("audit.alreadyFixed") : t("audit.fixSoonTitle")}
                >
                  {resolved ? t("audit.fixed") : t("audit.soon")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
