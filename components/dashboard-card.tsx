import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const positive = change >= 0;
  const colors = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-glow">
      <div className="absolute -right-8 -top-8 size-24 rounded-full bg-primary/[0.035] transition group-hover:scale-125" />
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-lg", colors[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight">{value}</p>
        <div className="pb-1 text-right">
          {Number.isFinite(change) ? (
            <span className={cn("inline-flex items-center text-xs font-semibold", positive ? "text-success" : "text-destructive")}>
              {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(change)}%
            </span>
          ) : null}
          <p className="mt-0.5 text-[10px] text-muted-foreground">{changeLabel}</p>
        </div>
      </div>
    </Card>
  );
}
