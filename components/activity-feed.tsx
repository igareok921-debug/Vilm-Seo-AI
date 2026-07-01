import { Check, Clock3, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityFeedItem {
  id?: string;
  title: string;
  detail: string;
  time: string;
  tone: "success" | "warning" | "primary" | "muted";
}

const config = {
  success: { icon: Check, className: "bg-success/10 text-success" },
  warning: { icon: TriangleAlert, className: "bg-warning/10 text-warning" },
  primary: { icon: Sparkles, className: "bg-primary/10 text-primary" },
  muted: { icon: Clock3, className: "bg-secondary text-muted-foreground" },
};

export function ActivityFeed({
  activities,
  limit,
}: {
  activities: ActivityFeedItem[];
  limit?: number;
}) {
  const visibleActivities = activities.slice(0, limit);

  return (
    <div className="space-y-1">
      {visibleActivities.map((activity, index) => {
        const item = config[activity.tone as keyof typeof config];
        const Icon = item.icon;
        return (
          <div key={activity.id ?? activity.title} className="relative flex gap-3 rounded-lg p-3 hover:bg-secondary/50">
            {index < visibleActivities.length - 1 && <span className="absolute left-[27px] top-11 h-6 w-px bg-border" />}
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", item.className)}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{activity.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{activity.detail}</p>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">{activity.time}</span>
          </div>
        );
      })}
    </div>
  );
}
