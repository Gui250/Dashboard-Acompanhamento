"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatAssistant, type ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, error]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;
    // O backend aceita até 30 mensagens; mandamos só as mais recentes.
    const next = [...messages, { role: "user" as const, content }].slice(-30);
    setMessages(next);
    setInput("");
    setError(null);
    setIsSending(true);
    try {
      let reply = "";
      await chatAssistant(next, (text) => {
        reply += text;
        setMessages([...next, { role: "assistant", content: reply }]);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "O assistente não conseguiu responder agora.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section aria-label="Assistente" className="flex h-[min(560px,calc(100vh-7rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-white shadow-2xl sm:w-[380px]">
          <header className="flex items-center justify-between bg-[#171717] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Assistente V4</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Pergunte sobre suas métricas</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar assistente" className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">Ex.: “Qual foi a receita total do mês passado?” ou “Quais dimensões mais venderam?”</p>
            )}
            {messages.map((message, i) => (
              <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm", message.role === "user" ? "ml-auto bg-primary text-white" : "bg-muted")}>
                {message.content}
              </div>
            ))}
            {isSending && messages.at(-1)?.role === "user" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando os dados…</div>
            )}
            {error && <p role="alert" className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{error}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t p-3">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escreva sua pergunta…" aria-label="Mensagem" maxLength={4000} autoFocus />
            <Button type="submit" size="icon" disabled={isSending || !input.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        aria-expanded={open}
        className="grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </div>
  );
}
