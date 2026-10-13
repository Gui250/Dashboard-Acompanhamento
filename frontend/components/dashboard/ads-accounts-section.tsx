"use client";

import { format } from "date-fns";
import { Loader2, Megaphone, MousePointerClick, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AdsSkeleton, DashboardError } from "@/components/dashboard/dashboard-parts";
import { MetaAdsDialog } from "@/components/dashboard/meta-ads-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import type { GoogleAccountsReport, MetaAccountsReport } from "@/lib/api";
import { ADS_STALE_MS, adsQuery, campaignsQuery, type AdsSource } from "@/lib/prefetch";
import { useQuery } from "@/hooks/use-query";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("pt-BR");
const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

// Contas: ativa/desativada/outro. Campanhas do Google também vêm pausada/removida.
const STATUS_STYLE: Record<string, string> = {
  ativa: "bg-emerald-100 text-emerald-700",
  desativada: "bg-neutral-200 text-neutral-600",
  removida: "bg-neutral-200 text-neutral-600",
  pausada: "bg-amber-100 text-amber-700",
  outro: "bg-amber-100 text-amber-700",
};

type Report = { from: string; to: string; accounts: { id: string; name: string; status: string; currency: string; spend: number }[] };
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
  action?: (account: Account<R>) => ReactNode; // última coluna, ex.: ver criativos
};

// Trocar o filtro mantém o resultado anterior na tela (esmaecido) até o novo chegar.
function useKeptQuery<T>({ key, fetcher }: { key: string; fetcher: () => Promise<unknown> }) {
  const { data, error, isLoading, refresh } = useQuery(key, fetcher as () => Promise<T | null>, ADS_STALE_MS);
  const last = useRef<T | undefined>(undefined);
  if (data) last.current = data;
  const report = data ?? (isLoading ? last.current : undefined);
  return { data, error, isLoading, refresh, report, refreshing: isLoading && !!report };
}

function Period({ from, to, refreshing }: { from?: string; to?: string; refreshing: boolean }) {
  return (
    <p className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground">
      {from && to && <>{format(new Date(`${from}T00:00:00`), "dd/MM/yyyy")} a {format(new Date(`${to}T00:00:00`), "dd/MM/yyyy")}</>}
      {refreshing && <><Loader2 className="h-3 w-3 animate-spin" />atualizando</>}
    </p>
  );
}

function NotConnected({ config }: { config: Config<never> }) {
  const Icon = config.icon;
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

function KpiCards({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map(([label, value]) => (
        <Card key={label} className="v4-cut">
          <CardContent className="p-4">
            <p className="data-label">{label}</p>
            <div className="mt-3 font-display text-2xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SpendBars({ title, description, empty, rows, refreshing }: { title: string; description: string; empty: string; rows: { name: string; spend: number }[]; refreshing: boolean }) {
  const data = useMemo(
    () => rows.filter((r) => r.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 10).map((r) => ({ label: r.name, value: r.spend })),
    [rows],
  );
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        {data.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p> : (
          <ChartContainer config={{ value: { label: "Investimento", color: "#e50915" } }} className="h-[360px] w-full">
            <BarChart data={data} layout="vertical" margin={{ top: 2, right: 18, left: 12, bottom: 2 }}>
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
  );
}

// Tabela com busca por nome. Serve para contas e, na visão de uma conta, para as campanhas dela.
function RowsTable<R extends Report>({ config, title, noun, rows, showSubtitle, showAction }: {
  config: Config<R>;
  title: string;
  noun: string;
  rows: Account<R>[];
  showSubtitle: boolean;
  showAction: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!hideEmpty || a.spend > 0));
  }, [rows, query, hideEmpty]);
  const action = showAction ? config.action : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Filtrar por nome" aria-label={`Filtrar ${noun}s por nome`} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />Ocultar {noun}s sem investimento</label>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{noun[0].toUpperCase() + noun.slice(1)}</th><th className="px-3 font-medium">Status</th>
              {config.columns.map(([h]) => <th key={h} className="px-3 text-right font-medium">{h}</th>)}
              {action && <th className="pl-3" />}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={config.columns.length + 2 + (action ? 1 : 0)} className="py-8 text-center text-muted-foreground">Nenhuma {noun} encontrada.</td></tr>}
            {shown.map((a) => {
              const m = new Intl.NumberFormat("pt-BR", { style: "currency", currency: a.currency });
              return (
                <tr key={a.id} className="border-b last:border-0 tabular-nums">
                  <td className="py-3 pr-3"><p className="font-semibold">{a.name}</p>{showSubtitle && config.subtitle && <p className="font-mono text-[10px] text-muted-foreground">{config.subtitle(a)}</p>}</td>
                  <td className="px-3">{a.status && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[a.status] ?? STATUS_STYLE.outro)}>{a.status}</span>}</td>
                  {config.columns.map(([h, cell], i) => <td key={h} className={cn("px-3 text-right", i === 0 && "font-semibold")}>{cell(a, m)}</td>)}
                  {action && <td className="pl-3 text-right">{action(a)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AdsAccountsSection<R extends Report>({ config, days }: { config: Config<R>; days: number }) {
  const query = useMemo(() => adsQuery(config.source, days), [config.source, days]);
  const { data, error, isLoading, refresh, report, refreshing } = useKeptQuery<R>(query);
  const currency = report?.accounts[0]?.currency ?? "BRL";
  const money = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency }), [currency]);
  const Icon = config.icon;

  if (data === null) return <NotConnected config={config as Config<never>} />;
  if (error) return <DashboardError message={error} onRetry={refresh} />;

  return (
    <section className="space-y-4" aria-busy={isLoading}>
      <div>
        <p className="data-label flex items-center gap-1.5 text-primary"><Icon className="h-3 w-3" />{config.label}</p>
        <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">{report ? config.title(report) : "Contas de anúncio"}</h3>
        <Period from={report?.from} to={report?.to} refreshing={refreshing} />
      </div>

      {!report ? <AdsSkeleton /> : (
        <div className={cn("space-y-4 transition-opacity duration-200", refreshing && "pointer-events-none opacity-60")}>
          <KpiCards items={config.kpis(report, money)} />
          <SpendBars title="Top 10 contas por investimento" description="Maiores gastos no período selecionado." empty="Nenhuma conta com investimento no período." rows={report.accounts} refreshing={refreshing} />
          <RowsTable config={config} title="Contas de anúncio" noun="conta" rows={report.accounts} showSubtitle showAction />
        </div>
      )}
    </section>
  );
}

// Visão de uma conta: KPIs da conta, campanhas por investimento e a tabela de campanhas.
function AccountView<R extends Report>({ config, accountId, days }: { config: Config<R>; accountId: string; days: number }) {
  const accountsQuery = useMemo(() => adsQuery(config.source, days), [config.source, days]);
  const accounts = useKeptQuery<R>(accountsQuery);
  const campaignQuery = useMemo(() => campaignsQuery(config.source, accountId, days), [config.source, accountId, days]);
  const campaigns = useKeptQuery<{ from: string; to: string; campaigns: Partial<Account<R>>[] }>(campaignQuery);

  const account = accounts.report?.accounts.find((a) => a.id === accountId) as Account<R> | undefined;
  const money = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency: account?.currency ?? "BRL" }), [account?.currency]);
  // Campanha herda da conta o que não traz (moeda); status só existe nas campanhas do Google.
  const rows = useMemo(
    () => account ? (campaigns.report?.campaigns ?? []).map((c) => ({ ...account, status: "", ...c }) as Account<R>) : [],
    [account, campaigns.report],
  );
  const refreshing = accounts.refreshing || campaigns.refreshing;
  const Icon = config.icon;

  if (accounts.data === null) return <NotConnected config={config as Config<never>} />;
  const error = accounts.error ?? campaigns.error;
  if (error) return <DashboardError message={error} onRetry={() => { accounts.refresh(); campaigns.refresh(); }} />;
  if (accounts.report && !account) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Conta não encontrada no {config.label}. Escolha outra no filtro.</CardContent></Card>;
  }

  return (
    <section className="space-y-4" aria-busy={accounts.isLoading || campaigns.isLoading}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="data-label flex items-center gap-1.5 text-primary"><Icon className="h-3 w-3" />{config.label} · conta de anúncio</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">{account?.name ?? "Carregando conta"}</h3>
          <Period from={accounts.report?.from} to={accounts.report?.to} refreshing={refreshing} />
        </div>
        {account && (
          <div className="flex items-center gap-3">
            {config.subtitle && <span className="font-mono text-xs text-muted-foreground">{config.subtitle(account)}</span>}
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[account.status] ?? STATUS_STYLE.outro)}>{account.status}</span>
            {config.action?.(account)}
          </div>
        )}
      </div>

      {!account || !campaigns.report ? <AdsSkeleton /> : (
        <div className={cn("space-y-4 transition-opacity duration-200", refreshing && "pointer-events-none opacity-60")}>
          <KpiCards items={config.kpis({ ...accounts.report, totals: account } as unknown as R, money)} />
          <SpendBars title="Top 10 campanhas por investimento" description="Campanhas desta conta com maior gasto no período." empty="Nenhuma campanha com investimento no período." rows={rows} refreshing={refreshing} />
          <RowsTable config={config} title="Campanhas" noun="campanha" rows={rows} showSubtitle={false} showAction={false} />
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
  action: (a) => <MetaAdsDialog accountId={a.id} accountName={a.name} />,
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

export function MetaAccountsSection({ days }: { days: number }) {
  return <AdsAccountsSection config={META} days={days} />;
}

export function GoogleAccountsSection({ days }: { days: number }) {
  return <AdsAccountsSection config={GOOGLE} days={days} />;
}

export function AdAccountView({ source, accountId, days }: { source: AdsSource; accountId: string; days: number }) {
  return source === "meta" ? <AccountView config={META} accountId={accountId} days={days} /> : <AccountView config={GOOGLE} accountId={accountId} days={days} />;
}
