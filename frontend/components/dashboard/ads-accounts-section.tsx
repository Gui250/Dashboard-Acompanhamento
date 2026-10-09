"use client";

import { format } from "date-fns";
import { Loader2, Megaphone, MousePointerClick, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AdsSkeleton, DashboardError } from "@/components/dashboard/dashboard-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import type { GoogleAccountsReport, MetaAccountsReport } from "@/lib/api";
import { ADS_STALE_MS, adsQuery, type AdsSource } from "@/lib/prefetch";
import { useQuery } from "@/hooks/use-query";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("pt-BR");
const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

type Status = "ativa" | "desativada" | "outro";
const STATUS_STYLE: Record<Status, string> = {
  ativa: "bg-emerald-100 text-emerald-700",
  desativada: "bg-neutral-200 text-neutral-600",
  outro: "bg-amber-100 text-amber-700",
};

type Report = { from: string; to: string; accounts: { id: string; name: string; status: Status; currency: string; spend: number }[] };
type Account<R extends Report> = R["accounts"][number];

// O que muda entre Meta e Google: rótulos, KPIs e colunas. O resto da seção é igual.
type Config<R extends Report> = {
  source: AdsSource;
  label: string;
  icon: LucideIcon;
  title: (report: R) => string;
  subtitle?: (account: Account<R>) => string;
  kpis: (report: R, money: Intl.NumberFormat) => [string, string][];
  columns: [string, (account: Account<R>, money: Intl.NumberFormat) => string][];
};

function AdsAccountsSection<R extends Report>({ config }: { config: Config<R> }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [query, setQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const { key, fetcher } = useMemo(() => adsQuery(config.source, days), [config.source, days]);
  const { data, error, isLoading, refresh } = useQuery(key, fetcher as () => Promise<R | null>, ADS_STALE_MS);

  // Trocar o período mantém o relatório anterior na tela (esmaecido) até o novo chegar.
  const last = useRef<R | undefined>(undefined);
  if (data) last.current = data;
  const report = data ?? (isLoading ? last.current : undefined);
  const refreshing = isLoading && !!report;

  const currency = report?.accounts[0]?.currency ?? "BRL";
  const money = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency }), [currency]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (report?.accounts ?? []).filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!hideEmpty || a.spend > 0));
  }, [report, query, hideEmpty]);

  const top10 = useMemo(
    () => [...(report?.accounts ?? [])].filter((a) => a.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 10).map((a) => ({ label: a.name, value: a.spend })),
    [report],
  );

  const Icon = config.icon;

  if (data === null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center p-8 text-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">{config.label} não conectado</p>
          <Link href="/integracoes" className="mt-1 text-sm text-primary underline">Conecte o {config.label} em Integrações</Link>
        </CardContent>
      </Card>
    );
  }
  if (error) return <DashboardError message={error} onRetry={refresh} />;

  return (
    <section className="space-y-4" aria-busy={isLoading}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="data-label flex items-center gap-1.5 text-primary"><Icon className="h-3 w-3" />{config.label}</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">{report ? config.title(report) : "Contas de anúncio"}</h3>
          <p className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground">
            {report && <>{format(new Date(`${report.from}T00:00:00`), "dd/MM/yyyy")} a {format(new Date(`${report.to}T00:00:00`), "dd/MM/yyyy")}</>}
            {refreshing && <><Loader2 className="h-3 w-3 animate-spin" />atualizando</>}
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button key={p} size="sm" variant={p === days ? "default" : "outline"} aria-pressed={p === days} onClick={() => setDays(p)}>{p} dias</Button>
          ))}
        </div>
      </div>

      {!report ? <AdsSkeleton /> : (
        <div className={cn("space-y-4 transition-opacity duration-200", refreshing && "pointer-events-none opacity-60")}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {config.kpis(report, money).map(([label, value]) => (
              <Card key={label} className="v4-cut">
                <CardContent className="p-4">
                  <p className="data-label">{label}</p>
                  <div className="mt-3 font-display text-2xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{value}</div>
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
                    <Bar dataKey="value" fill="var(--color-value)" radius={[0, 5, 5, 0]} barSize={18} isAnimationActive={!refreshing} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contas de anúncio</CardTitle>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <div className="relative sm:max-w-xs sm:flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Filtrar por nome" aria-label="Filtrar contas por nome" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />Ocultar contas sem investimento</label>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Conta</th><th className="px-3 font-medium">Status</th>
                    {config.columns.map(([h]) => <th key={h} className="px-3 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={config.columns.length + 2} className="py-8 text-center text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
                  {rows.map((a) => {
                    const m = new Intl.NumberFormat("pt-BR", { style: "currency", currency: a.currency });
                    return (
                      <tr key={a.id} className="border-b last:border-0 tabular-nums">
                        <td className="py-3 pr-3"><p className="font-semibold">{a.name}</p>{config.subtitle && <p className="font-mono text-[10px] text-muted-foreground">{config.subtitle(a)}</p>}</td>
                        <td className="px-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[a.status])}>{a.status}</span></td>
                        {config.columns.map(([h, cell], i) => <td key={h} className={cn("px-3 text-right", i === 0 && "font-semibold")}>{cell(a, m)}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

const META: Config<MetaAccountsReport> = {
  source: "meta",
  label: "Meta Ads",
  icon: Megaphone,
  title: (r) => r.business.name,
  subtitle: (a) => a.accountId,
  kpis: ({ totals: t }, money) => [
    ["Investimento", money.format(t.spend)],
    ["Impressões", compact.format(t.impressions)],
    ["Cliques", int.format(t.clicks)],
    ["CTR", pct(t.ctr)],
    ["CPC", money.format(t.cpc)],
    ["Leads", int.format(t.leads)],
  ],
  columns: [
    ["Investimento", (a, m) => m.format(a.spend)],
    ["Impressões", (a) => int.format(a.impressions)],
    ["Cliques", (a) => int.format(a.clicks)],
    ["CTR", (a) => pct(a.ctr)],
    ["CPC", (a, m) => m.format(a.cpc)],
    ["CPM", (a, m) => m.format(a.cpm)],
    ["Leads", (a) => int.format(a.leads)],
    ["Compras", (a) => int.format(a.purchases)],
  ],
};

const GOOGLE: Config<GoogleAccountsReport> = {
  source: "google",
  label: "Google Ads",
  icon: MousePointerClick,
  title: (r) => r.email ?? "Contas do Google Ads",
  subtitle: (a) => a.id.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3"),
  kpis: ({ totals: t }, money) => [
    ["Investimento", money.format(t.spend)],
    ["Impressões", compact.format(t.impressions)],
    ["Cliques", int.format(t.clicks)],
    ["CTR", pct(t.ctr)],
    ["Conversões", int.format(Math.round(t.conversions))],
    ["Valor de conversão", money.format(t.conversionsValue)],
  ],
  columns: [
    ["Investimento", (a, m) => m.format(a.spend)],
    ["Impressões", (a) => int.format(a.impressions)],
    ["Cliques", (a) => int.format(a.clicks)],
    ["CTR", (a) => pct(a.ctr)],
    ["CPC", (a, m) => m.format(a.cpc)],
    ["CPM", (a, m) => m.format(a.cpm)],
    ["Conversões", (a) => int.format(Math.round(a.conversions))],
    ["Valor conv.", (a, m) => m.format(a.conversionsValue)],
  ],
};

export function MetaAccountsSection() {
  return <AdsAccountsSection config={META} />;
}

export function GoogleAccountsSection() {
  return <AdsAccountsSection config={GOOGLE} />;
}
