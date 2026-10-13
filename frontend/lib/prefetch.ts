import { format, subDays } from "date-fns";
import {
  ApiError,
  getCreatives,
  getDashboard,
  getGoogleAccounts,
  getGoogleCampaigns,
  getGoogleConfig,
  getMetaAccounts,
  getMetaCampaigns,
  getMetaTopAds,
  type DateRange,
  type MetricSection,
} from "@/lib/api";
import { prefetchQuery } from "@/lib/query-cache";

export const DASHBOARD_STALE_MS = 20_000;
// Meta e Google são APIs externas e lentas: segura o resultado por mais tempo.
export const ADS_STALE_MS = 60_000;

// Período padrão dos filtros do dashboard operacional.
export const DEFAULT_DAYS = 30;

// Últimos N dias, incluindo hoje.
export function lastDays(days: number): DateRange {
  const now = new Date();
  return { from: format(subDays(now, days - 1), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
}

export function dashboardQueryKey(section: string, timelineKey: string, rankingKey?: string, range?: DateRange) {
  return `dashboard:${section}:${timelineKey}:${rankingKey ?? ""}:${range ? `${range.from}:${range.to}` : ""}`;
}

export function prefetchDashboard(section: MetricSection, timelineKey: string, rankingKey?: string, range?: DateRange) {
  return prefetchQuery(
    dashboardQueryKey(section, timelineKey, rankingKey, range),
    () => getDashboard(section, timelineKey, rankingKey, range),
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

export function topAdsQuery(days: number, accountId?: string) {
  const { from, to } = lastDays(days);
  return { key: `meta-top-ads:${from}:${to}:${accountId ?? ""}`, fetcher: () => orNull(getMetaTopAds(from, to, accountId)) };
}

const campaignFetchers = { meta: getMetaCampaigns, google: getGoogleCampaigns };

export function campaignsQuery(source: AdsSource, accountId: string, days: number) {
  const { from, to } = lastDays(days);
  const fetcher: () => Promise<unknown> = () => orNull<unknown>(campaignFetchers[source](accountId, from, to));
  return { key: `${source}-campaigns:${accountId}:${from}:${to}`, fetcher };
}

export function adsQuery(source: AdsSource, days: number) {
  const { from, to } = lastDays(days);
  const fetcher: () => Promise<unknown> = () => adsFetchers[source](from, to);
  return { key: `${source}:${from}:${to}`, fetcher };
}

function prefetchAds(source: AdsSource, days = DEFAULT_DAYS) {
  const { key, fetcher } = adsQuery(source, days);
  prefetchQuery(key, fetcher, ADS_STALE_MS).catch(() => undefined); // o erro aparece quando a seção montar
}

export function prefetchAppData() {
  void prefetchDashboard("comercial", "faturamento", "vendas");
  void prefetchDashboard("operacional", "criativos_em_esteira", "contas_ativas", lastDays(DEFAULT_DAYS));
  void prefetchQuery("creatives", getCreatives, DASHBOARD_STALE_MS);
}

export function prefetchRouteData(href: string) {
  if (href.startsWith("/comercial")) void prefetchDashboard("comercial", "faturamento", "vendas");
  else if (href.startsWith("/operacional")) {
    void prefetchDashboard("operacional", "criativos_em_esteira", "contas_ativas", lastDays(DEFAULT_DAYS));
    prefetchAds("meta");
    prefetchAds("google");
    const top = topAdsQuery(DEFAULT_DAYS);
    prefetchQuery(top.key, top.fetcher, ADS_STALE_MS).catch(() => undefined);
  } else if (href.startsWith("/kanban")) void prefetchQuery("creatives", getCreatives, DASHBOARD_STALE_MS);
  else if (href.startsWith("/integracoes")) {
    // A chave do MCP fica de fora: o cache vai para o sessionStorage.
    void prefetchQuery("integration:google", getGoogleConfig, DASHBOARD_STALE_MS);
  }
}
