"use client";

import { format } from "date-fns";
import { ImageOff, Loader2, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DashboardError } from "@/components/dashboard/dashboard-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MetaTopAd } from "@/lib/api";
import { ADS_STALE_MS, topAdsQuery } from "@/lib/prefetch";
import { useQuery } from "@/hooks/use-query";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;
const SHOWN = 12;
const int = new Intl.NumberFormat("pt-BR");
const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

const RANKS = [
  { key: "leads", label: "Leads" },
  { key: "purchases", label: "Compras" },
  { key: "ctr", label: "CTR" },
  { key: "spend", label: "Investimento" },
] as const;

type Rank = (typeof RANKS)[number]["key"];

function money(currency: string, value: number) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  }
}

function metricValue(ad: MetaTopAd, rank: Rank) {
  if (rank === "spend") return money(ad.currency, ad.spend);
  if (rank === "ctr") return pct(ad.ctr);
  return int.format(ad[rank]);
}

export function TopCreativesSection() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [rank, setRank] = useState<Rank>("leads");
  const { key, fetcher } = useMemo(() => topAdsQuery(days), [days]);
  const { data, error, isLoading, refresh } = useQuery(key, fetcher, ADS_STALE_MS);

  const last = useRef<NonNullable<typeof data> | undefined>(undefined);
  if (data) last.current = data;
  const report = data ?? (isLoading ? last.current : undefined);
  const refreshing = isLoading && !!report;

  const ads = useMemo(() => {
    const pool = report?.ads ?? [];
    return [...pool].sort((a, b) => b[rank] - a[rank] || b.spend - a.spend).slice(0, SHOWN);
  }, [report, rank]);

  if (data === null) return null;
  if (error && !report) return <DashboardError message={error} onRetry={refresh} />;

  return (
    <section className="space-y-4" aria-busy={isLoading}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="data-label flex items-center gap-1.5 text-primary"><Sparkles className="h-3 w-3" />Meta Ads</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em]">Criativos que mais performam</h3>
          <p className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground">
            {report && <>{format(new Date(`${report.from}T00:00:00`), "dd/MM/yyyy")} a {format(new Date(`${report.to}T00:00:00`), "dd/MM/yyyy")} · anúncios ocultos ficam de fora</>}
            {refreshing && <><Loader2 className="h-3 w-3 animate-spin" />atualizando</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANKS.map((item) => (
            <Button key={item.key} size="sm" variant={item.key === rank ? "default" : "outline"} aria-pressed={item.key === rank} onClick={() => setRank(item.key)}>{item.label}</Button>
          ))}
          <span className="mx-1 hidden h-9 w-px bg-border sm:block" />
          {PERIODS.map((p) => (
            <Button key={p} size="sm" variant={p === days ? "default" : "outline"} aria-pressed={p === days} onClick={() => setDays(p)}>{p} dias</Button>
          ))}
        </div>
      </div>

      {!report ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-lg border bg-white/70" />)}
        </div>
      ) : ads.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum criativo com veiculação neste período.</CardContent></Card>
      ) : (
        <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", refreshing && "pointer-events-none opacity-60")}>
          {ads.map((ad, index) => (
            <article key={ad.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
              <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
                {ad.imageUrl
                  ? <img src={ad.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  : <ImageOff className="h-6 w-6 text-muted-foreground" />}
                <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-[#171717] font-mono text-[10px] font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 text-sm font-semibold">{ad.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{ad.accountName}{ad.campaign ? ` · ${ad.campaign}` : ""}</p>
                <p className="mt-auto pt-3 font-display text-2xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">{metricValue(ad, rank)}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{RANKS.find((item) => item.key === rank)?.label}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-[11px] tabular-nums">
                  <p><span className="block text-[10px] text-muted-foreground">Gasto</span>{money(ad.currency, ad.spend)}</p>
                  <p><span className="block text-[10px] text-muted-foreground">CTR</span>{pct(ad.ctr)}</p>
                  <p><span className="block text-[10px] text-muted-foreground">Leads</span>{int.format(ad.leads)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
