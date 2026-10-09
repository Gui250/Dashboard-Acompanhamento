"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, ImageOff, Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approvalImageUrl, decideApproval, getApproval, type Approval } from "@/lib/api";
import { cn } from "@/lib/utils";

type Decision = "aprovar" | "ajustes";

const STAGE_LABEL: Record<string, string> = { briefing: "Briefing", producao: "Produção", revisao: "Revisão", aprovado: "Aprovado", publicado: "Publicado" };

// Aberta pelo link do e-mail, sem login. O botão do e-mail só pré-seleciona a decisão: nada muda sem o clique aqui
// (leitores de e-mail costumam abrir os links sozinhos).
export default function ApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [approval, setApproval] = useState<Approval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Decision | null>(null);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("decision");
    if (preset === "aprovar" || preset === "ajustes") setDecision(preset);
    getApproval(token).then(setApproval).catch((reason: Error) => setError(reason.message));
  }, [token]);

  async function submit() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    try {
      setApproval(await decideApproval(token, decision === "aprovar" ? { decision } : { decision, note: note.trim() }));
      setDone(decision);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar a decisão.");
    } finally {
      setBusy(false);
    }
  }

  const c = approval?.creative;

  return (
    <main className="min-h-screen bg-[#f4f4f5] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl bg-white shadow-panel">
        <header className="flex items-center gap-3 bg-[#171717] px-6 py-5 text-white">
          <Image src="/v4-logo.png" width={32} height={32} alt="V4 Company" className="rounded-lg" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]">Aprovação de criativo</span>
        </header>

        {!approval && !error && <p className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando o criativo…</p>}
        {!approval && error && <p className="p-8 text-sm font-medium text-destructive">{error}</p>}

        {c && (
          <div className="space-y-6 p-6 sm:p-8">
            <div>
              <p className="data-label text-primary">{approval.pending ? "Aguardando sua aprovação" : `Etapa atual: ${STAGE_LABEL[c.stage] ?? c.stage}`}</p>
              <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{c.title}</h1>
            </div>

            <div className="grid place-items-center overflow-hidden rounded-lg border bg-muted">
              {c.hasImage
                ? <img src={approvalImageUrl(token)} alt={`Criativo ${c.title}`} className="max-h-[70vh] w-full object-contain" />
                : <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><ImageOff className="h-6 w-6" />Criativo sem imagem</div>}
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[["Funil", c.funnel ?? "-"], ["Conta", c.account], ["Formato", c.format], ["Responsável", c.owner]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>

            {done && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                {done === "aprovar" ? "Criativo aprovado. O card foi para Aprovado no Kanban." : "Pedido de ajustes enviado. O card voltou para Produção com o seu comentário."}
              </div>
            )}

            {!done && !approval.pending && (
              <p className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">Este criativo já saiu de Revisão, então não há decisão pendente neste link.</p>
            )}

            {c.reviewNote && !approval.pending && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0" />
                <p><strong>Ajustes pedidos:</strong> {c.reviewNote}</p>
              </div>
            )}

            {approval.pending && (
              <div className="space-y-4 border-t pt-6">
                <div className="grid gap-2 sm:grid-cols-2">
                  {([["aprovar", "Aprovar criativo"], ["ajustes", "Pedir ajustes"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={decision === value}
                      onClick={() => setDecision(value)}
                      className={cn("rounded-lg border px-4 py-3 text-sm font-bold transition-colors", decision === value ? (value === "aprovar" ? "border-primary bg-primary text-white" : "border-foreground bg-foreground text-white") : "bg-white hover:border-foreground/30")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {decision === "ajustes" && (
                  <div className="space-y-2">
                    <label htmlFor="note" className="text-sm font-semibold">O que precisa mudar?</label>
                    <textarea id="note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Ex.: trocar a chamada, aumentar o logo…" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                )}
                {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                <Button className="w-full" disabled={busy || !decision || (decision === "ajustes" && note.trim().length < 3)} onClick={() => void submit()}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {decision === "ajustes" ? "Enviar pedido de ajustes" : decision === "aprovar" ? "Confirmar aprovação" : "Escolha uma opção"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
