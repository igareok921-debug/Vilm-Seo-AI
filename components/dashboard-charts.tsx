"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

function LineChart({
  data,
  color,
  fill,
}: {
  data: number[];
  color: string;
  fill: string;
}) {
  const id = useId().replace(/:/g, "");
  const width = 600;
  const height = 190;
  const safeData = data.length > 1 ? data : [0, 0];
  const rawMin = Math.min(...safeData);
  const rawMax = Math.max(...safeData);
  const min = rawMin === rawMax ? rawMin - 1 : rawMin * 0.9;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax * 1.05;
  const points = safeData.map((value, index) => {
    const x = (index / (safeData.length - 1)) * width;
    const y = height - ((value - min) / (max - min)) * (height - 20) - 10;
    return `${x},${y}`;
  });
  const area = `0,${height} ${points.join(" ")} ${width},${height}`;

  return (
    <div className="relative h-[190px] w-full">
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((line) => <span key={line} className="w-full border-t border-dashed border-border/70" />)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity=".28" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${id})`} />
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => {
          const [cx, cy] = point.split(",");
          return index === points.length - 1 ? <circle key={point} cx={cx} cy={cy} r="5" fill={color} stroke="hsl(var(--card))" strokeWidth="3" vectorEffect="non-scaling-stroke" /> : null;
        })}
      </svg>
    </div>
  );
}

export function SeoEvolutionChart({ data }: { data: number[] }) {
  return <LineChart data={data} color="#8b7cf6" fill="#8b7cf6" />;
}

export function IndexedPagesChart({ data }: { data: number[] }) {
  return <LineChart data={data} color="#22c77a" fill="#22c77a" />;
}

export function TrafficChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);

  return (
    <div className="flex h-[180px] items-end gap-2 pt-6">
      {data.map((value, index) => {
        const height = (value / max) * 100;
        return (
          <div key={index} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn(
                "w-full rounded-t-sm bg-primary/25 transition group-hover:bg-primary/60",
                index === data.length - 1 && "bg-primary",
              )}
              style={{ height: `${height}%` }}
            />
            <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[9px] text-background group-hover:block">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
