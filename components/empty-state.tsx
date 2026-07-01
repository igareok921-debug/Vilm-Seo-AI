import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
  actionHref,
  onAction,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-card/30 p-8 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action && actionHref ? (
        <Button className="mt-5" asChild>
          <Link href={actionHref}>{action}</Link>
        </Button>
      ) : action ? (
        <Button className="mt-5" onClick={onAction}>{action}</Button>
      ) : null}
    </div>
  );
}
