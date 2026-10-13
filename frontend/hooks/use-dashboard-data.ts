"use client";

import { useRef } from "react";
import { dashboardQueryKey, DASHBOARD_STALE_MS } from "@/lib/prefetch";
import { getDashboard, type DashboardSnapshot, type DateRange, type MetricSection } from "@/lib/api";
import { touchStale } from "@/lib/query-cache";
import { useQuery } from "@/hooks/use-query";

// range = filtro de período. Trocar o filtro mantém os dados anteriores na tela (refreshing) até os novos chegarem.
export function useDashboardData(section: MetricSection, timelineKey: string, rankingKey?: string, range?: DateRange) {
  const key = dashboardQueryKey(section, timelineKey, rankingKey, range);
  const query = useQuery(key, () => getDashboard(section, timelineKey, rankingKey, range), DASHBOARD_STALE_MS);
  const last = useRef<DashboardSnapshot | undefined>(undefined);
  if (query.data) last.current = query.data;
  const data = query.data ?? (query.isLoading ? last.current : undefined);

  return {
    metrics: data?.metrics ?? [],
    timeline: data?.timeline ?? [],
    ranking: data?.ranking ?? [],
    isLoading: !data && query.isLoading,
    refreshing: !!data && query.isLoading,
    error: query.error,
    refresh: () => {
      touchStale("dashboard:");
      query.refresh();
    },
  };
}
