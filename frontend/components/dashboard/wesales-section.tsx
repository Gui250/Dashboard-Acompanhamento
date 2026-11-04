"use client";

import { format } from "date-fns";
import { Handshake, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AdsSkeleton, DashboardError } from "@/components/dashboard/dashboard-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { GoogleAccountsReport, MetaAccountsReport, WesalesSummary } from "@/lib/api";
import { ADS_STALE_MS, adsQuery, wesalesQuery, type AdsSource } from "@/lib/prefetch";
import { useQuery } from "@/hooks/use-query";
import { cn } from "@/lib/utils";

const int = new Intl.NumberFormat("pt-BR");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;
const SELECT = "h-9 min-w-0 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 sm:w-72";

// ponytail: o WeSales conectado é de um cliente só; vincular a integração à conta de anúncio quando outro cliente tiver WeSales.
const WESALES_CLIENT = "zenite";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Na visão de uma conta de anúncio, mostra o WeSales só se a conta for do cliente dele. Mesma chave de cache da lista de contas.
export function WesalesAccountSection({ source, accountId, days }: { source: AdsSource; accountId: string; days: number }) {
  const { key, fetcher } = useMemo(() => adsQuery(source, days), [source, days]);
  const { data } = useQuery(key, fetcher as () => Promise<MetaAccountsReport | GoogleAccountsReport | null>, ADS_STALE_MS);
  const name = data?.accounts.find((a) => a.id === accountId)?.name ?? "";
  return normalize(name).includes(WESALES_CLIENT) ? <WesalesSection days={days} /> : null;
}

// Funil de vendas do WeSales: KPIs do período, oportunidades por etapa do pipeline escolhido e resultado por responsável.
function WesalesSection({ days }: { days: number }) {
  const query = useMemo(() => wesalesQuery(days), [days]);
  const { data, error, isLoading, refresh } = useQuery(query.key, query.fetcher as () => Promise<WesalesSummary | null>, ADS_STALE_MS);
  // Trocar o período mantém o resultado anterior na tela (esmaecido) até o novo chegar.
  const last = useRef<WesalesSummary | undefined>(undefined);
  if (data) last.current = data;
  const report = data ?? (isLoading ? last.current : undefined);
  const refreshing = isLoading && !!report;

  const [pipelineId, setPipelineId] = useState("");
  // Padrão: o pipeline com mais oportunidades no período.
  const pipeline = useMemo(() => {
    const list = report?.pipelines ?? [];
    const total = (p: (typeof list)[number]) => p.stages.reduce((s, st) => s + st.count, 0);
    return list.find((p) => p.id === pipelineId) ?? [...list].sort((a, b) => total(b) - total(a))[0];
  }, [report, pipelineId]);
  const stages = useMemo(() => (pipeline?.stages ?? []).filter((s) => s.count > 0).map((s) => ({ label: s.name, value: s.count })), [pipeline]);

  if (data === null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center p-8 text-center">
          <Handshake className="h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">WeSales não conectado</p>
          <Link href="/integracoes" className="mt-1 text-sm text-primary underline">Conecte o WeSales em Integrações</Link>
        </CardContent>
      </Card>
    );
  }
  if (error) return <DashboardError message={error} onRetry={refresh} />;

  const t = report?.totals;
  const kpis: [string, string][] = t ? [
    ["Leads", int.format(t.leads)],
    ["Em aberto", int.format(t.open)],
    ["Vendas", int.format(t.won)],
    ["Faturamento", money.format(t.wonValue)],
    ["Valor em aberto", money.format(t.openValue)],
    ["Conversão", pct(t.conversion)],
  ] : [];

  return (
    <section className="space-y-4" aria-busy={isLoading}>
      <div>
        <p className="data-label flex items-center gap-1.5 text-primary"><Handshake className="h-3 w-3" />WeSales</p>
        <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">{report?.location.name ?? "Funil de vendas"}</h3>
        <p className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground">
          {report && <>{format(new Date(`${report.from}T00:00:00`), "dd/MM/yyyy")} a {format(new Date(`${report.to}T00:00:00`), "dd/MM/yyyy")}</>}
          {refreshing && <><Loader2 className="h-3 w-3 animate-spin" />atualizando</>}
        </p>
      </div>

      {!report ? <AdsSkeleton /> : (
        <div className={cn("space-y-4 transition-opacity duration-200", refreshing && "pointer-events-none opacity-60")}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {kpis.map(([label, value]) => (
              <Card key={label} className="v4-cut">
                <CardContent className="p-4">
                  <p className="data-label">{label}</p>
                  <div className="mt-3 font-display text-2xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                <div>
                  <CardTitle>Oportunidades por etapa</CardTitle>
                  <CardDescription>Etapa atual dos leads criados no período.</CardDescription>
                </div>
                <select className={SELECT} aria-label="Pipeline" value={pipeline?.id ?? ""} onChange={(e) => setPipelineId(e.target.value)}>
                  {report.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </CardHeader>
              <CardContent>
                {stages.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma oportunidade neste pipeline no período.</p> : (
                  <ChartContainer config={{ value: { label: "Oportunidades", color: "#e50915" } }} className="w-full" style={{ height: Math.max(160, stages.length * 30) }}>
                    <BarChart data={stages} layout="vertical" margin={{ top: 2, right: 18, left: 12, bottom: 2 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 4" />
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={180} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={[0, 5, 5, 0]} barSize={18} isAnimationActive={!refreshing} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Por responsável</CardTitle><CardDescription>Leads recebidos e vendas ganhas no período.</CardDescription></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Responsável</th>
                      <th className="px-3 text-right font-medium">Leads</th>
                      <th className="px-3 text-right font-medium">Vendas</th>
                      <th className="pl-3 text-right font-medium">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.owners.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma oportunidade no período.</td></tr>}
                    {report.owners.map((o) => (
                      <tr key={o.name} className="border-b last:border-0 tabular-nums">
                        <td className="py-3 pr-3 font-semibold">{o.name}</td>
                        <td className="px-3 text-right">{int.format(o.leads)}</td>
                        <td className="px-3 text-right">{int.format(o.won)}</td>
                        <td className="pl-3 text-right font-semibold">{money.format(o.wonValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
