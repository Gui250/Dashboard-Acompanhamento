import { getCreatives, getDashboard, type MetricSection } from "@/lib/api";
import { prefetchQuery } from "@/lib/query-cache";

export const DASHBOARD_STALE_MS = 20_000;

export function dashboardQueryKey(section: string, timelineKey: string, rankingKey?: string) {
  return `dashboard:${section}:${timelineKey}:${rankingKey ?? ""}`;
}

export function prefetchDashboard(section: MetricSection, timelineKey: string, rankingKey?: string) {
  return prefetchQuery(
    dashboardQueryKey(section, timelineKey, rankingKey),
    () => getDashboard(section, timelineKey, rankingKey),
    DASHBOARD_STALE_MS,
  );
}

export function prefetchAppData() {
  void prefetchDashboard("comercial", "faturamento", "vendas");
  void prefetchDashboard("operacional", "criativos_em_esteira", "contas_ativas");
  void prefetchQuery("creatives", getCreatives, DASHBOARD_STALE_MS);
}

export function prefetchRouteData(href: string) {
  if (href.startsWith("/comercial")) void prefetchDashboard("comercial", "faturamento", "vendas");
  else if (href.startsWith("/operacional")) void prefetchDashboard("operacional", "criativos_em_esteira", "contas_ativas");
  else if (href.startsWith("/kanban")) void prefetchQuery("creatives", getCreatives, DASHBOARD_STALE_MS);
}
