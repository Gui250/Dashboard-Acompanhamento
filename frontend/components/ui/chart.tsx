"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip, type TooltipProps } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color?: string }>;

const ChartContext = React.createContext<ChartConfig>({});

export function ChartContainer({
  config,
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement> & { config: ChartConfig; children: React.ComponentProps<typeof ResponsiveContainer>["children"] }) {
  return (
    <ChartContext.Provider value={config}>
      <div
        className={cn("flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-none", className)}
        style={Object.fromEntries(Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color])) as React.CSSProperties}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;

export function ChartTooltipContent({ active, payload, label, className }: TooltipProps<number, string> & { className?: string }) {
  const config = React.useContext(ChartContext);
  if (!active || !payload?.length) return null;
  return (
    <div className={cn("min-w-32 rounded-md border bg-white px-3 py-2 text-xs shadow-xl", className)}>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center justify-between gap-5 font-semibold">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {config[String(item.dataKey)]?.label ?? item.name}
          </span>
          <span>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(item.value))}</span>
        </div>
      ))}
    </div>
  );
}
