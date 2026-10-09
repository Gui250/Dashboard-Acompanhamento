"use client";

import { Eye, EyeOff, ImageOff, Images, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getMetaAds, setMetaAdHidden } from "@/lib/api";
import { ADS_STALE_MS } from "@/lib/prefetch";
import { useQuery } from "@/hooks/use-query";

// Criativos dos anúncios veiculando agora numa conta da Meta. "Ocultar" só esconde no dashboard.
export function MetaAdsDialog({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Images className="h-4 w-4" />Criativos</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criativos em veiculação</DialogTitle>
          <DialogDescription>{accountName}: anúncios ativos agora na Meta. Ocultar só tira o anúncio do dashboard; ele continua rodando na Meta.</DialogDescription>
        </DialogHeader>
        {open && <MetaAdsGrid accountId={accountId} />}
      </DialogContent>
    </Dialog>
  );
}

function MetaAdsGrid({ accountId }: { accountId: string }) {
  const { data, error, isLoading, refresh } = useQuery(`meta-ads:${accountId}`, () => getMetaAds(accountId), ADS_STALE_MS);
  const [hidden, setHidden] = useState<Record<string, boolean>>({}); // muda na hora, antes do refresh
  const [showHidden, setShowHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando anúncios na Meta…</p>;
  if (error) return <p className="py-10 text-sm text-destructive">{error}</p>;

  const ads = (data?.ads ?? []).map((ad) => ({ ...ad, hidden: hidden[ad.id] ?? ad.hidden }));
  const hiddenCount = ads.filter((ad) => ad.hidden).length;
  const visible = ads.filter((ad) => showHidden || !ad.hidden);

  async function toggle(id: string, next: boolean) {
    setBusy(id);
    try {
      await setMetaAdHidden(id, next);
      setHidden((h) => ({ ...h, [id]: next }));
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{ads.length} anúncio(s) ativo(s){hiddenCount > 0 && `, ${hiddenCount} oculto(s)`}</span>
        {hiddenCount > 0 && (
          <label className="flex items-center gap-2"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />Mostrar ocultos</label>
        )}
      </div>
      {visible.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum anúncio ativo para mostrar.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((ad) => (
            <article key={ad.id} className={`flex flex-col overflow-hidden rounded-lg border ${ad.hidden ? "opacity-50" : ""}`}>
              <div className="flex aspect-square items-center justify-center bg-muted">
                {ad.imageUrl
                  ? <img src={ad.imageUrl} alt={`Criativo ${ad.name}`} className="h-full w-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  : <ImageOff className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                <p className="font-semibold">{ad.name}</p>
                {ad.campaign && <p className="text-xs text-muted-foreground">{ad.campaign}{ad.adset && ` · ${ad.adset}`}</p>}
                {ad.title && <p className="font-medium">{ad.title}</p>}
                {ad.body && <p className="line-clamp-3 text-xs text-muted-foreground">{ad.body}</p>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{ad.type ?? "—"} · {ad.id}</span>
                  <Button size="sm" variant="ghost" disabled={busy === ad.id} onClick={() => toggle(ad.id, !ad.hidden)}>
                    {busy === ad.id ? <Loader2 className="h-4 w-4 animate-spin" /> : ad.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {ad.hidden ? "Mostrar" : "Ocultar"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
