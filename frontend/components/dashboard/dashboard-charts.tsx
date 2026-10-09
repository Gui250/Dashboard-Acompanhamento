"use client";

import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { EmptyChart } from "@/components/dashboard/dashboard-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatShortDate } from "@/lib/utils";
import type { MetricSeriesPoint } from "@/lib/api";

const axisNumberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

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
