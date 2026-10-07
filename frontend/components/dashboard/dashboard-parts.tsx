"use client";

import { AlertTriangle, ArrowUpRight, BarChart3, Database, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatMetricValue, formatShortDate } from "@/lib/utils";
import type { Metric, MetricSeriesPoint } from "@/lib/api";

const axisNumberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="data-label text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-4xl">{title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function KpiGrid({ items }: { items: { label: string; keyName: string; value: number; helper: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <Card key={item.keyName} className="v4-cut relative min-h-36 transition-transform duration-200 hover:-translate-y-0.5">
          <CardContent className="flex h-full flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <p className="data-label">{item.label}</p>
              <span className="font-mono text-[9px] font-semibold text-neutral-300">0{index + 1}</span>
            </div>
            <div className="mt-6">
              <div className="font-display text-[34px] font-extrabold leading-none tracking-[-0.04em]">{formatMetricValue(item.keyName, item.value)}</div>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><ArrowUpRight className="h-3 w-3 text-primary" />{item.helper}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-primary/20 bg-white">
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><AlertTriangle className="h-5 w-5" /></div>
        <div className="flex-1">
          <h3 className="font-semibold">Dados temporariamente indisponíveis</h3>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" onClick={onRetry}><RefreshCw className="h-4 w-4" />Tentar novamente</Button>
      </CardContent>
    </Card>
  );
}

export function LoadingDashboard() {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-lg border bg-white/70" />)}</div>;
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Database className="h-5 w-5" /></div>
      <p className="mt-3 text-sm font-semibold">Ainda não há dados para exibir</p>
      <p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

export function TimelineCard({ title, description, data, dataKey }: { title: string; description: string; data: MetricSeriesPoint[]; dataKey: string }) {
  const chartData = data.map((point) => ({ ...point, shortLabel: /^\d{4}-\d{2}-\d{2}$/.test(point.label) ? formatShortDate(point.label) : point.label }));
  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div>
        <span className="rounded-md bg-primary/10 p-2 text-primary"><BarChart3 className="h-4 w-4" /></span>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart text="Faça o primeiro lançamento para iniciar a série histórica." /> : (
          <ChartContainer config={{ value: { label: dataKey, color: "#e50915" } }} className="h-[280px] w-full">
            <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 4" />
              <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: number) => axisNumberFormatter.format(value)}
                width={66}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={3} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function RankingCard({ title, description, data }: { title: string; description: string; data: MetricSeriesPoint[] }) {
  const visible = data.filter((item) => item.label).slice(0, 6);
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        {visible.length === 0 ? <EmptyChart text="Inclua o nome do vendedor no campo dimensão." /> : (
          <ChartContainer config={{ value: { label: "Vendas", color: "#171717" } }} className="h-[280px] w-full">
            <BarChart data={visible} layout="vertical" margin={{ top: 2, right: 18, left: 12, bottom: 2 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 4" />
              <XAxis type="number" hide />
              <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={82} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={[0, 5, 5, 0]} barSize={18} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentMetrics({ metrics }: { metrics: Metric[] }) {
  const recent = [...metrics].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <Card>
      <CardHeader><CardTitle>Últimos lançamentos</CardTitle><CardDescription>Registros mais recentes recebidos pela API.</CardDescription></CardHeader>
      <CardContent className="space-y-1">
        {recent.length === 0 ? <EmptyChart text="Seus lançamentos recentes aparecerão aqui." /> : recent.map((metric) => (
          <div key={metric.id} className="flex items-center gap-3 border-b py-3 last:border-0">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{metric.dimension || metric.key.replaceAll("_", " ")}</p><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{metric.date} · {metric.key.replaceAll("_", " ")}</p></div>
            <span className="text-sm font-bold tabular-nums">{formatMetricValue(metric.key, metric.value)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
