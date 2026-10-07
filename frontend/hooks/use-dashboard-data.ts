"use client";

import { useCallback, useEffect, useState } from "react";
import { getMetrics, getSeries, type Metric, type MetricSection, type MetricSeriesPoint } from "@/lib/api";

type DashboardData = {
  metrics: Metric[];
  timeline: MetricSeriesPoint[];
  ranking: MetricSeriesPoint[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useDashboardData(
  section: MetricSection,
  timelineKey: string,
  rankingKey?: string,
): DashboardData {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [timeline, setTimeline] = useState<MetricSeriesPoint[]>([]);
  const [ranking, setRanking] = useState<MetricSeriesPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      getMetrics(section),
      getSeries(section, timelineKey, "date"),
      rankingKey ? getSeries(section, rankingKey, "dimension") : Promise.resolve([]),
    ])
      .then(([nextMetrics, nextTimeline, nextRanking]) => {
        if (!active) return;
        setMetrics(nextMetrics);
        setTimeline(nextTimeline);
        setRanking(nextRanking);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Falha ao carregar os indicadores.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [rankingKey, section, timelineKey, version]);

  return { metrics, timeline, ranking, isLoading, error, refresh };
}
