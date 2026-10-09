"use client";

import dynamic from "next/dynamic";
import { Building2, ChevronRight, UserRound } from "lucide-react";
import { AdsSkeleton, ChartSkeleton, DashboardError, KpiGrid, LoadingDashboard, PageIntro, RecentMetrics } from "@/components/dashboard/dashboard-parts";
import { MetricDialog } from "@/components/dashboard/metric-dialog";
import { ImportDialog } from "@/components/dashboard/import-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import type { Metric } from "@/lib/api";

const TimelineCard = dynamic(() => import("@/components/dashboard/dashboard-charts").then((mod) => mod.TimelineCard), { ssr: false, loading: () => <ChartSkeleton /> });
const adsSection = () => import("@/components/dashboard/ads-accounts-section");
const MetaAccountsSection = dynamic(() => adsSection().then((mod) => mod.MetaAccountsSection), { ssr: false, loading: () => <AdsSkeleton /> });
const GoogleAccountsSection = dynamic(() => adsSection().then((mod) => mod.GoogleAccountsSection), { ssr: false, loading: () => <AdsSkeleton /> });

function total(metrics: Metric[], key: string) {
  return metrics.filter((metric) => metric.key === key).reduce((sum, metric) => sum + metric.value, 0);
}

export default function OperacionalPage() {
  const { metrics, timeline, ranking: accounts, isLoading, error, refresh } = useDashboardData("operacional", "criativos_em_esteira", "contas_ativas");
  const accountRecords = metrics.filter((metric) => metric.key === "contas_ativas" && metric.dimension);
  const kpis = [
    { label: "Criativos em esteira", keyName: "criativos_em_esteira", value: total(metrics, "criativos_em_esteira"), helper: "Volume operacional registrado" },
    { label: "Contas ativas", keyName: "contas_ativas", value: total(metrics, "contas_ativas"), helper: "Soma das contas lançadas" },
    { label: "Contas mapeadas", keyName: "contas", value: new Set(accountRecords.map((item) => item.dimension)).size, helper: "Dimensões únicas na operação" },
    { label: "Lançamentos", keyName: "registros", value: metrics.length, helper: "Registros operacionais" },
  ];

  return (
    <div className="mx-auto max-w-[1480px] space-y-7">
      <PageIntro
        eyebrow="Ritmo operacional"
        title="Clareza para fazer fluir."
        description="Uma leitura direta do volume criativo e das contas que passam pela operação — sem perder o contexto de cada lead."
        action={<div className="flex flex-wrap gap-2"><ImportDialog onImported={refresh} /><MetricDialog section="operacional" onCreated={refresh} /></div>}
      />
      {error ? <DashboardError message={error} onRetry={refresh} /> : (
        <>
          {isLoading ? <LoadingDashboard /> : <KpiGrid items={kpis} />}
          {!isLoading && (
            <div className="grid gap-4 xl:grid-cols-5">
              <div className="xl:col-span-3"><TimelineCard title="Criativos em movimento" description="Itens da esteira agrupados por data." data={timeline} dataKey="Criativos" /></div>
              <Card className="xl:col-span-2">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div><CardTitle>Contas por lead</CardTitle><CardDescription>Contas ativas agrupadas pela dimensão informada.</CardDescription></div>
                  <span className="rounded-md bg-primary/10 p-2 text-primary"><Building2 className="h-4 w-4" /></span>
                </CardHeader>
                <CardContent>
                  {accounts.length === 0 ? (
                    <div className="flex h-[280px] flex-col items-center justify-center text-center"><UserRound className="h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Nenhuma conta mapeada</p><p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">Lance contas ativas e informe a conta ou lead na dimensão.</p></div>
                  ) : (
                    <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
                      {accounts.map((account, index) => (
                        <div key={account.label} className="group flex items-center gap-3 rounded-md border border-transparent px-2 py-3 hover:border-border hover:bg-muted/60">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#171717] font-mono text-[10px] font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{account.label}</p><p className="text-[10px] text-muted-foreground">Conta / lead ativo</p></div>
                          <span className="text-sm font-bold tabular-nums">{account.value}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          {!isLoading && <RecentMetrics metrics={metrics} />}
        </>
      )}
      <MetaAccountsSection />
      <GoogleAccountsSection />
    </div>
  );
}
