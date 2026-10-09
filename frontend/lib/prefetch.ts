import { format, subDays } from "date-fns";
import {
  ApiError,
  getCreatives,
  getDashboard,
  getGoogleAccounts,
  getGoogleConfig,
  getMetaAccounts,
  type MetricSection,
} from "@/lib/api";
import { prefetchQuery } from "@/lib/query-cache";

export const DASHBOARD_STALE_MS = 20_000;
// Meta e Google são APIs externas e lentas: segura o resultado por mais tempo.
export const ADS_STALE_MS = 60_000;

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

// 409 = integração não configurada: vira null para a tela mostrar o convite em vez de erro.
function orNull<T>(promise: Promise<T>) {
  return promise.catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 409) return null;
    throw error;
  });
}

const adsFetchers = {
  meta: (from: string, to: string) => orNull(getMetaAccounts(from, to)),
  google: (from: string, to: string) => orNull(getGoogleAccounts(from, to)),
};
export type AdsSource = keyof typeof adsFetchers;

export function adsQuery(source: AdsSource, days: number) {
  const now = new Date();
  const from = format(subDays(now, days - 1), "yyyy-MM-dd");
  const to = format(now, "yyyy-MM-dd");
  const fetcher: () => Promise<unknown> = () => adsFetchers[source](from, to);
  return { key: `${source}:${from}:${to}`, fetcher };
}

function prefetchAds(source: AdsSource, days = 30) {
  const { key, fetcher } = adsQuery(source, days);
  prefetchQuery(key, fetcher, ADS_STALE_MS).catch(() => undefined); // o erro aparece quando a seção montar
}

export function prefetchAppData() {
  void prefetchDashboard("comercial", "faturamento", "vendas");
  void prefetchDashboard("operacional", "criativos_em_esteira", "contas_ativas");
  void prefetchQuery("creatives", getCreatives, DASHBOARD_STALE_MS);
}

export function prefetchRouteData(href: string) {
  if (href.startsWith("/comercial")) void prefetchDashboard("comercial", "faturamento", "vendas");
  else if (href.startsWith("/operacional")) {
    void prefetchDashboard("operacional", "criativos_em_esteira", "contas_ativas");
    prefetchAds("meta");
    prefetchAds("google");
  } else if (href.startsWith("/kanban")) void prefetchQuery("creatives", getCreatives, DASHBOARD_STALE_MS);
  else if (href.startsWith("/integracoes")) {
    // A chave do MCP fica de fora: o cache vai para o sessionStorage.
    void prefetchQuery("integration:google", getGoogleConfig, DASHBOARD_STALE_MS);
  }
}
