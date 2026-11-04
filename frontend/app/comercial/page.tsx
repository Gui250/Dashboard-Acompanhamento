"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton, DashboardError, KpiGrid, LoadingDashboard, PageIntro, RecentMetrics } from "@/components/dashboard/dashboard-parts";
import { MetricDialog } from "@/components/dashboard/metric-dialog";
import { ImportDialog } from "@/components/dashboard/import-dialog";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import type { Metric } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { can } from "@/lib/permissions";

const TimelineCard = dynamic(() => import("@/components/dashboard/dashboard-charts").then((mod) => mod.TimelineCard), { ssr: false, loading: () => <ChartSkeleton /> });
const RankingCard = dynamic(() => import("@/components/dashboard/dashboard-charts").then((mod) => mod.RankingCard), { ssr: false, loading: () => <ChartSkeleton /> });

function metricValue(metrics: Metric[], key: string) {
  const entries = metrics.filter((metric) => metric.key === key);
  if (key.includes("taxa")) return entries.sort((a, b) => b.date.localeCompare(a.date))[0]?.value ?? 0;
  return entries.reduce((total, metric) => total + metric.value, 0);
}

export default function ComercialPage() {
  const { user } = useAuth();
  const { metrics, timeline, ranking, isLoading, error, refresh } = useDashboardData("comercial", "faturamento", "vendas");
  const kpis = [
    { label: "Faturamento", keyName: "faturamento", value: metricValue(metrics, "faturamento"), helper: "Soma do período registrado" },
    { label: "Vendas", keyName: "vendas", value: metricValue(metrics, "vendas"), helper: "Negócios lançados" },
    { label: "Leads", keyName: "leads", value: metricValue(metrics, "leads"), helper: "Oportunidades recebidas" },
    { label: "Conversão", keyName: "taxa_conversao", value: metricValue(metrics, "taxa_conversao"), helper: "Última taxa informada" },
  ];

  return (
    <div className="mx-auto max-w-[1480px] space-y-7">
      <PageIntro
        eyebrow="Pulso comercial"
        title="Da oportunidade ao resultado."
        description="Acompanhe a cadência de receita, o volume do funil e quem está puxando o resultado comercial."
        action={can(user, "metrics.manage") ? <div className="flex flex-wrap gap-2"><ImportDialog onImported={refresh} /><MetricDialog section="comercial" onCreated={refresh} /></div> : <span className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground">Somente leitura</span>}
      />
      {error ? <DashboardError message={error} onRetry={refresh} /> : (
        <>
          {isLoading ? <LoadingDashboard /> : <KpiGrid items={kpis} />}
          {!isLoading && (
            <div className="grid gap-4 xl:grid-cols-3">
              <TimelineCard title="Evolução de faturamento" description="Soma de faturamento agrupada por data." data={timeline} dataKey="Faturamento" />
              <RankingCard title="Top vendedores" description="Vendas agrupadas por dimensão." data={ranking} />
            </div>
          )}
          {!isLoading && <RecentMetrics metrics={metrics} />}
        </>
      )}
    </div>
  );
}
