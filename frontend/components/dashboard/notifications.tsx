"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ProtectedCreativeImage } from "@/components/kanban/creative-image";
import { getCreatives, getNotifications, type ApprovalNotice } from "@/lib/api";
import { refreshQuery } from "@/lib/query-cache";
import { playApprovalSound, unlockAudio } from "@/lib/sound";
import { cn } from "@/lib/utils";

const SEEN_KEY = "v4-dashboard-approvals-seen";
const SOUND_KEY = "v4-dashboard-approval-sound";
const POLL_MS = 20_000;

function readStorage(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

const ago = (date: string) => formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });

// O carimbo verde sobre a miniatura: o momento do aviso.
function Stamp({ animate, className }: { animate?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 m-auto grid h-fit w-fit place-items-center rounded-[5px] border-[2.5px] border-[#0f7a54] bg-white/80 px-1.5 py-0.5 font-display text-[13px] font-extrabold leading-none tracking-[0.02em] text-[#0f7a54] shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.9),inset_0_0_0_3px_#0f7a54]",
        animate ? "approval-stamp" : "-rotate-[11deg]",
        className,
      )}
    >
      Aprovado
    </span>
  );
}

function ApprovalToast({ notice, onOpen }: { notice: ApprovalNotice; onOpen: () => void }) {
  const { creative } = notice;
  return (
    <Link
      href="/kanban"
      onClick={onOpen}
      className="flex w-[min(360px,calc(100vw-32px))] items-center gap-4 rounded-xl border border-[#0f7a54]/25 bg-white p-3 pr-4 text-left shadow-[0_18px_40px_-12px_rgba(15,122,84,.35)] outline-none focus-visible:ring-2 focus-visible:ring-[#0f7a54]"
    >
      <span className="approval-press relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-lg border bg-muted">
        <ProtectedCreativeImage creative={creative} className="h-full w-full" />
        <Stamp animate />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[#0f7a54]">A Flávia aprovou</span>
        <span className="mt-0.5 block truncate font-display text-lg font-extrabold leading-tight tracking-[-0.02em]">{creative.title}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{creative.account}, {creative.format}. Já está em Aprovado.</span>
      </span>
    </Link>
  );
}

// Sino no cabeçalho: consulta as aprovações a cada 20s, também com a aba em segundo plano (o som avisa de longe;
// o navegador espaça o timer de abas ocultas). Voltar para a aba consulta na hora. Aprovação nova = toast com carimbo + som.
export function NotificationBell() {
  const [items, setItems] = useState<ApprovalNotice[]>([]);
  const [seen, setSeen] = useState(0);
  const [sound, setSound] = useState(true);
  const [open, setOpen] = useState(false);
  const newest = useRef<number | null>(null); // null = primeira carga: histórico entra na lista, sem toast nem som
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(Number(readStorage(SEEN_KEY)) || 0);
    setSound(readStorage(SOUND_KEY) !== "off");
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    let busy = false;
    async function poll() {
      if (busy) return;
      busy = true;
      try {
        const base = newest.current; // lida antes do await: duas consultas ao mesmo tempo não repetem avisos
        const fresh = (await getNotifications(base ?? 0)).filter((n) => n.id > (newest.current ?? 0));
        newest.current = Math.max(newest.current ?? 0, fresh[0]?.id ?? 0); // primeira carga vazia também vira a base
        if (!fresh.length) return;
        if (base !== null) {
          for (const notice of [...fresh].reverse()) {
            toast.custom((id) => <ApprovalToast notice={notice} onOpen={() => toast.dismiss(id)} />, { duration: 9000 });
          }
          if (soundRef.current) playApprovalSound();
          void refreshQuery("creatives", getCreatives).catch(() => undefined); // o card muda de coluna no kanban
        }
        setItems((current) => [...fresh, ...current.filter((c) => !fresh.some((f) => f.id === c.id))].slice(0, 20));
      } catch {
        // falha de rede: tenta de novo no próximo ciclo
      } finally {
        busy = false;
      }
    }
    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const latest = items[0]?.id ?? 0;
    if (latest > seen) {
      setSeen(latest);
      writeStorage(SEEN_KEY, String(latest));
    }
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, items, seen]);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    writeStorage(SOUND_KEY, next ? "on" : "off");
    if (next) {
      unlockAudio();
      playApprovalSound(0.05); // amostra do som ao ligar
    }
  }

  const unread = items.filter((item) => item.id > seen).length;

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={unread ? `Aprovações: ${unread} nova(s)` : "Aprovações"}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#0f7a54] px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border bg-white shadow-xl">
          <div className="border-b px-4 py-3">
            <p className="font-display text-base font-bold">Aprovações</p>
            <p className="text-xs text-muted-foreground">Criativos aprovados pela Flávia aparecem aqui na hora.</p>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma aprovação ainda. Envie um criativo para aprovação pelo Kanban.</li>}
            {items.map((item) => (
              <li key={item.id}>
                <Link href="/kanban" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", item.id > seen && "bg-[#0f7a54]/[0.05]")}>
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <ProtectedCreativeImage creative={item.creative} className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.creative.title}</span>
                    <span className="block text-xs text-muted-foreground">Aprovado pela Flávia {ago(item.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            className="flex w-full items-center gap-2 border-t px-4 py-3 text-left text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 focus-visible:outline-none"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {sound ? "Som dos avisos ligado" : "Som dos avisos desligado"}
          </button>
        </div>
      )}
    </div>
  );
}

