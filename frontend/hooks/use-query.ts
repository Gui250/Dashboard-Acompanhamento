"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { prefetchQuery, readQuery, refreshQuery, subscribeQuery } from "@/lib/query-cache";

type QueryState<T> = { data?: T; error: string | null };

export function useQuery<T>(key: string, fetcher: () => Promise<T>, staleTime = 20_000) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [state, setState] = useState<QueryState<T>>({ error: null });

  useLayoutEffect(() => {
    let active = true;
    const cached = readQuery<T>(key);
    setState(cached.data !== undefined ? { data: cached.data, error: null } : { error: null });

    const unsubscribe = subscribeQuery(key, () => {
      if (!active) return;
      const next = readQuery<T>(key);
      if (next.data !== undefined) setState({ data: next.data, error: null });
      else if (next.error) setState({ error: next.error });
    });

    prefetchQuery(key, () => fetcherRef.current(), staleTime).catch((reason: unknown) => {
      if (!active) return;
      setState((current) => current.data !== undefined
        ? { data: current.data, error: null }
        : { error: reason instanceof Error ? reason.message : "Falha ao carregar." });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, staleTime]);

  const refresh = useCallback(() => {
    refreshQuery(key, () => fetcherRef.current()).catch(() => undefined);
  }, [key]);

  return {
    data: state.data,
    error: state.data !== undefined ? null : state.error,
    isLoading: state.data === undefined && !state.error,
    refresh,
  };
}
