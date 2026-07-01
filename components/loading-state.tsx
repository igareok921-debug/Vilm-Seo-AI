import { cn } from "@/lib/utils";

export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-xl border bg-card p-5", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="relative h-12 overflow-hidden rounded-lg bg-secondary">
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      ))}
    </div>
  );
}
