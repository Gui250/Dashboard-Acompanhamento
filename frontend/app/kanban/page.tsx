"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { AlertTriangle, GripVertical, Layers3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageIntro } from "@/components/dashboard/dashboard-parts";
import { CreateCreativeDialog } from "@/components/kanban/create-creative-dialog";
import { CreativeDetailDialog } from "@/components/kanban/creative-detail-dialog";
import { ProtectedCreativeImage } from "@/components/kanban/creative-image";
import { Button } from "@/components/ui/button";
import { ApiError, getCreatives, updateCreative, type Creative, type CreativeStage } from "@/lib/api";
import { peekQuery, prefetchQuery, refreshQuery, setQueryData } from "@/lib/query-cache";
import { cn } from "@/lib/utils";

const stages: { id: CreativeStage; label: string; color: string }[] = [
  { id: "briefing", label: "Briefing", color: "bg-slate-400" },
  { id: "producao", label: "Produção", color: "bg-blue-500" },
  { id: "revisao", label: "Revisão", color: "bg-amber-500" },
  { id: "aprovado", label: "Aprovado", color: "bg-emerald-500" },
  { id: "publicado", label: "Publicado", color: "bg-primary" },
];

type LoadError = { message: string; unavailable: boolean };

export default function KanbanPage() {
  const [cards, setCards] = useState<Creative[]>([]);
  const [selected, setSelected] = useState<Creative | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [highlighted, setHighlighted] = useState<CreativeStage | null>(null);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const suppressClick = useRef(false);
  const epoch = useRef(0);

  const loadCards = useCallback(async (force = false) => {
    const ticket = ++epoch.current;
    const cached = peekQuery<Creative[]>("creatives");
    if (cached) {
      setCards(cached);
      setIsLoading(false);
    } else setIsLoading(true);
    setLoadError(null);
    try {
      const next = force
        ? await refreshQuery("creatives", getCreatives)
        : await prefetchQuery("creatives", getCreatives, 20_000);
      if (ticket !== epoch.current) return;
      setCards(next);
    } catch (reason) {
      if (ticket !== epoch.current) return;
      setLoadError({
        message: reason instanceof Error ? reason.message : "Não foi possível carregar a esteira.",
        unavailable: reason instanceof ApiError && reason.status === 404,
      });
    } finally {
      if (ticket === epoch.current) setIsLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    const cached = peekQuery<Creative[]>("creatives");
    if (!cached) return;
    setCards(cached);
    setIsLoading(false);
  }, []);

  useEffect(() => { void loadCards(); }, [loadCards]);

  function commit(next: Creative[]) {
    epoch.current += 1;
    setCards(next);
    setQueryData("creatives", next);
  }

  async function dropCard(event: DragEvent<HTMLDivElement>, stage: CreativeStage) {
    event.preventDefault();
    const id = draggedId;
    setDraggedId(null);
    setHighlighted(null);
    if (id === null) return;
    const previous = cards.find((card) => card.id === id);
    if (!previous || previous.stage === stage) return;

    const next = cards.map((card) => card.id === id ? { ...card, stage } : card);
    commit(next);
    setSavingIds((current) => new Set(current).add(id));
    try {
      const updated = await updateCreative(id, { stage });
      commit(next.map((card) => card.id === id ? updated : card));
      setSelected((current) => current?.id === id ? updated : current);
    } catch (reason) {
      commit(next.map((card) => card.id === id ? previous : card));
      toast.error("Movimento desfeito", { description: reason instanceof Error ? reason.message : "Não foi possível atualizar a etapa." });
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function openWithKeyboard(event: KeyboardEvent<HTMLElement>, creative: Creative) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected(creative);
    }
  }

  function addCreative(creative: Creative) {
    commit([...cards, creative]);
  }

  function updateCard(creative: Creative) {
    commit(cards.map((card) => card.id === creative.id ? creative : card));
    setSelected(creative);
  }

  function deleteCard(id: number) {
    commit(cards.filter((card) => card.id !== id));
    setSelected(null);
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-7">
      <PageIntro
        eyebrow="Esteira de criativos"
        title="Cada ideia no seu próximo passo."
        description="Organize a produção entre as etapas, acompanhe os responsáveis e visualize cada peça sem sair da esteira."
        action={<CreateCreativeDialog onCreated={addCreative} />}
      />

      {isLoading ? <KanbanSkeleton /> : loadError ? (
        <div className="rounded-lg border border-primary/20 bg-white p-6 shadow-panel">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><AlertTriangle className="h-5 w-5" /></span>
            <div className="flex-1">
              <h3 className="font-semibold">{loadError.unavailable ? "Kanban aguardando conexão" : "Não foi possível carregar o Kanban"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{loadError.unavailable ? "A API de criativos ainda não está disponível. Tente novamente quando o serviço estiver pronto." : loadError.message}</p>
            </div>
            <Button variant="outline" onClick={() => void loadCards(true)}><RefreshCw className="h-4 w-4" />Tentar novamente</Button>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed bg-white/70 p-8 text-center">
          <div>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><Layers3 className="h-6 w-6" /></span>
            <h3 className="mt-4 font-display text-xl font-bold">A esteira está pronta</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Crie o primeiro item para acompanhar sua produção do briefing à publicação.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="grid min-w-[1260px] grid-cols-5 gap-3">
            {stages.map((stage) => {
              const stageCards = cards.filter((card) => card.stage === stage.id);
              return (
                <div
                  key={stage.id}
                  className={cn("min-h-[560px] rounded-lg border bg-[#f7f8f9]/90 p-3 transition-colors", highlighted === stage.id && "border-primary/40 bg-primary/[0.035]")}
                  onDragOver={(event) => { event.preventDefault(); setHighlighted(stage.id); }}
                  onDragLeave={() => setHighlighted(null)}
                  onDrop={(event) => void dropCard(event, stage.id)}
                >
                  <div className="mb-4 flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", stage.color)} /><h3 className="text-sm font-bold">{stage.label}</h3></div>
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 font-mono text-[10px] font-bold text-muted-foreground shadow-sm">{stageCards.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {stageCards.map((card) => (
                      <article
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        draggable
                        onClick={() => { if (!suppressClick.current) setSelected(card); }}
                        onKeyDown={(event) => openWithKeyboard(event, card)}
                        onDragStart={() => { suppressClick.current = true; setDraggedId(card.id); }}
                        onDragEnd={() => { setDraggedId(null); setHighlighted(null); window.setTimeout(() => { suppressClick.current = false; }, 0); }}
                        className={cn("group cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-panel focus-visible:ring-2 focus-visible:ring-ring", draggedId === card.id && "opacity-40")}
                      >
                        {card.hasImage && <ProtectedCreativeImage creative={card} className="aspect-[16/9] w-full border-b" />}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <span className="rounded bg-muted px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{card.format}</span>
                            {savingIds.has(card.id) ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <GripVertical className="h-4 w-4 cursor-grab text-neutral-300 transition-colors group-hover:text-neutral-500" />}
                          </div>
                          <h4 className="mt-4 text-sm font-bold leading-5">{card.title}</h4>
                          <p className="mt-1 text-xs text-muted-foreground">{card.account}</p>
                          <div className="mt-5 flex items-center justify-between border-t pt-3">
                            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">#{String(card.id).padStart(4, "0")}</span>
                            <span className="grid h-7 min-w-7 max-w-24 place-items-center truncate rounded-full bg-[#171717] px-2 text-[9px] font-bold text-white">{card.owner}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                    {stageCards.length === 0 && <div className="grid h-28 place-items-center rounded-lg border border-dashed text-xs text-muted-foreground">Arraste um card para cá</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <CreativeDetailDialog
          creative={selected}
          open
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          onUpdated={updateCard}
          onDeleted={deleteCard}
        />
      )}
    </div>
  );
}

function KanbanSkeleton() {
  return <div className="grid min-w-[900px] grid-cols-5 gap-3 overflow-hidden">{stages.map((stage) => <div key={stage.id} className="h-[560px] animate-pulse rounded-lg border bg-white/65 p-3"><div className="h-5 w-24 rounded bg-muted" /><div className="mt-5 h-36 rounded-lg bg-muted/80" /></div>)}</div>;
}
