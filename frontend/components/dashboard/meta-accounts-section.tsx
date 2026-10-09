"use client";

import { format, subDays } from "date-fns";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { DashboardError, LoadingDashboard } from "@/components/dashboard/dashboard-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { ApiError, getMetaAccounts, type MetaAccount, type MetaAccountsReport } from "@/lib/api";
import { useQuery } from "@/hooks/use-query";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("pt-BR");
const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;
const STATUS_STYLE: Record<MetaAccount["status"], string> = {
  ativa: "bg-emerald-100 text-emerald-700",
  desativada: "bg-neutral-200 text-neutral-600",
  outro: "bg-amber-100 text-amber-700",
};

export function MetaAccountsSection() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [query, setQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const range = useMemo(() => {
    const now = new Date();
    return { from: format(subDays(now, days - 1), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  }, [days]);
  const { data, error, isLoading, refresh } = useQuery<MetaAccountsReport | null>(
    `meta:${range.from}:${range.to}`,
    () => getMetaAccounts(range.from, range.to).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 409) return null;
      throw err;
    }),
    60_000,
  );
  const report = data ?? undefined;
  const notConfigured = data === null;

  const currency = report?.accounts[0]?.currency ?? "BRL";
  const money = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency }), [currency]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (report?.accounts ?? []).filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!hideEmpty || a.spend > 0));
  }, [report, query, hideEmpty]);

  const top10 = useMemo(() => (report?.accounts ?? []).filter((a) => a.spend > 0).slice(0, 10).map((a) => ({ label: a.name, value: a.spend })), [report]);

  if (notConfigured) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center p-8 text-center">
          <Megaphone className="h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Meta Ads não conectada</p>
          <Link href="/integracoes" className="mt-1 text-sm text-primary underline">Conecte a Meta em Integrações</Link>
        </CardContent>
      </Card>
    );
  }
  if (error) return <DashboardError message={error} onRetry={refresh} />;

  const t = report?.totals;
  const kpis = t && [
    ["Investimento", money.format(t.spend)],
    ["Impressões", compact.format(t.impressions)],
    ["Cliques", int.format(t.clicks)],
    ["CTR", pct(t.ctr)],
    ["CPC", money.format(t.cpc)],
    ["Leads", int.format(t.leads)],
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="data-label text-primary">Meta Ads</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">{report?.business.name ?? "Contas de anúncio"}</h3>
          {report && <p className="text-xs text-muted-foreground">{format(new Date(`${report.from}T00:00:00`), "dd/MM/yyyy")} a {format(new Date(`${report.to}T00:00:00`), "dd/MM/yyyy")}</p>}
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button key={p} size="sm" variant={p === days ? "default" : "outline"} onClick={() => setDays(p)}>{p} dias</Button>
          ))}
        </div>
      </div>

      {isLoading || !report || !kpis ? <LoadingDashboard /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {kpis.map(([label, value]) => (
              <Card key={label} className="v4-cut">
                <CardContent className="p-4">
                  <p className="data-label">{label}</p>
                  <div className="mt-3 font-display text-2xl font-extrabold leading-none tracking-[-0.03em]">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Top 10 contas por investimento</CardTitle><CardDescription>Maiores gastos no período selecionado.</CardDescription></CardHeader>
            <CardContent>
              {top10.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma conta com investimento no período.</p> : (
                <ChartContainer config={{ value: { label: "Investimento", color: "#e50915" } }} className="h-[360px] w-full">
                    <BarChart data={top10} layout="vertical" margin={{ top: 2, right: 18, left: 12, bottom: 2 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 4" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={[0, 5, 5, 0]} barSize={18} />
                    </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contas de anúncio</CardTitle>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <Input placeholder="Filtrar por nome" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:max-w-xs" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />Ocultar contas sem investimento</label>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Conta</th><th className="px-3 font-medium">Status</th>
                    {["Investimento", "Impressões", "Cliques", "CTR", "CPC", "CPM", "Leads", "Compras"].map((h) => <th key={h} className="px-3 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
                  {rows.map((a) => {
                    const m = new Intl.NumberFormat("pt-BR", { style: "currency", currency: a.currency });
                    return (
                      <tr key={a.id} className="border-b last:border-0 tabular-nums">
                        <td className="py-3 pr-3"><p className="font-semibold">{a.name}</p><p className="font-mono text-[10px] text-muted-foreground">{a.accountId}</p></td>
                        <td className="px-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[a.status])}>{a.status}</span></td>
                        <td className="px-3 text-right font-semibold">{m.format(a.spend)}</td>
                        <td className="px-3 text-right">{int.format(a.impressions)}</td>
                        <td className="px-3 text-right">{int.format(a.clicks)}</td>
                        <td className="px-3 text-right">{pct(a.ctr)}</td>
                        <td className="px-3 text-right">{m.format(a.cpc)}</td>
                        <td className="px-3 text-right">{m.format(a.cpm)}</td>
                        <td className="px-3 text-right">{int.format(a.leads)}</td>
                        <td className="px-3 text-right">{int.format(a.purchases)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
