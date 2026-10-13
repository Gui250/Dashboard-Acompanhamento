"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GoogleAccountsReport, MetaAccountsReport } from "@/lib/api";
import { ADS_STALE_MS, adsQuery, type AdsSource } from "@/lib/prefetch";
import { useQuery } from "@/hooks/use-query";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export type AdAccountFilter = { source: AdsSource; id: string } | null;

// Mesma chave de cache das seções de anúncios: a lista de contas não gera requisição a mais.
function useAccounts<R extends MetaAccountsReport | GoogleAccountsReport>(source: AdsSource, days: number) {
  const { key, fetcher } = useMemo(() => adsQuery(source, days), [source, days]);
  const { data } = useQuery(key, fetcher as () => Promise<R | null>, ADS_STALE_MS);
  return useMemo(() => [...(data?.accounts ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [data]);
}

const SELECT = "h-9 min-w-0 rounded-md border border-input bg-white px-3 text-sm outline-none transition-shadow focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 sm:w-72";

// Uma linha de filtros acima de tudo: o período vale para a página inteira; a conta troca a página pela visão daquela conta.
export function OperacionalFilters({ days, onDays, account, onAccount }: {
  days: Period;
  onDays: (days: Period) => void;
  account: AdAccountFilter;
  onAccount: (account: AdAccountFilter) => void;
}) {
  const meta = useAccounts<MetaAccountsReport>("meta", days);
  const google = useAccounts<GoogleAccountsReport>("google", days);
  const value = account ? `${account.source}:${account.id}` : "";

  function pick(next: string) {
    const at = next.indexOf(":");
    onAccount(at < 0 ? null : { source: next.slice(0, at) as AdsSource, id: next.slice(at + 1) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div>
        <p className="data-label mb-1.5">Período</p>
        <div className="flex gap-2" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <Button key={p} size="sm" variant={p === days ? "default" : "outline"} aria-pressed={p === days} onClick={() => onDays(p)}>{p} dias</Button>
          ))}
        </div>
      </div>
      <label className="flex min-w-0 flex-col">
        <span className="data-label mb-1.5">Conta de anúncio</span>
        <select className={SELECT} value={value} onChange={(e) => pick(e.target.value)}>
          <option value="">Todas as contas</option>
          {meta.length > 0 && <optgroup label="Meta Ads">{meta.map((a) => <option key={a.id} value={`meta:${a.id}`}>{a.name}</option>)}</optgroup>}
          {google.length > 0 && <optgroup label="Google Ads">{google.map((a) => <option key={a.id} value={`google:${a.id}`}>{a.name}</option>)}</optgroup>}
        </select>
      </label>
      {account && <Button size="sm" variant="ghost" onClick={() => onAccount(null)}><X className="h-4 w-4" />Ver todas as contas</Button>}
    </div>
  );
}
