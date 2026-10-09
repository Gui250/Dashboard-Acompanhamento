"use client";

import { dashboardQueryKey, DASHBOARD_STALE_MS } from "@/lib/prefetch";
import { getDashboard, type MetricSection } from "@/lib/api";
import { touchStale } from "@/lib/query-cache";
import { useQuery } from "@/hooks/use-query";

export function useDashboardData(section: MetricSection, timelineKey: string, rankingKey?: string) {
  const key = dashboardQueryKey(section, timelineKey, rankingKey);
  const query = useQuery(key, () => getDashboard(section, timelineKey, rankingKey), DASHBOARD_STALE_MS);

  return {
    metrics: query.data?.metrics ?? [],
    timeline: query.data?.timeline ?? [],
    ranking: query.data?.ranking ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refresh: () => {
      touchStale("dashboard:");
      query.refresh();
    },
  };
}
