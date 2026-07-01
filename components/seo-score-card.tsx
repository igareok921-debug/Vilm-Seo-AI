import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function SeoScoreCard({
  score,
  size = "default",
}: {
  score: number;
  size?: "sm" | "default" | "lg";
}) {
  const tone = score >= 80 ? "text-success" : score >= 65 ? "text-warning" : "text-destructive";
  const stroke = score >= 80 ? "#22c77a" : score >= 65 ? "#f4ad32" : "#eb5757";

  if (size === "sm") {
    return (
      <div className="flex min-w-[112px] items-center gap-3">
        <span className={cn("text-sm font-bold", tone)}>{score}/100</span>
        <Progress
          value={score}
          className="h-1.5 flex-1"
          indicatorClassName={score >= 80 ? "bg-success" : score >= 65 ? "bg-warning" : "bg-destructive"}
        />
      </div>
    );
  }

  const dimension = size === "lg" ? 130 : 96;
  const radius = size === "lg" ? 52 : 37;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dimension, height: dimension }}>
      <svg width={dimension} height={dimension} className="-rotate-90">
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className={cn("font-[var(--font-manrope)] font-bold", size === "lg" ? "text-3xl" : "text-xl", tone)}>{score}</p>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">din 100</p>
      </div>
    </div>
  );
}
