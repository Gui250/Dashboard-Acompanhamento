"use client";

import { Check, Copy, Eye, EyeOff, TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { API_URL, getMcpConfig } from "@/lib/api";
import { cn } from "@/lib/utils";

const MCP_URL = `${API_URL}/mcp`;
const PLACEHOLDER = "<SUA_CHAVE>";
const mask = (key: string) => `${"•".repeat(12)}${key.slice(-4)}`;

const SNIPPETS = {
  claude: {
    label: "Claude Code",
    copy: "Copiar comando",
    build: (key: string) => `claude mcp add --transport http v4-dashboard ${MCP_URL} \\\n  --header "Authorization: Bearer ${key}"`,
  },
  json: {
    label: "JSON (Cursor e outros)",
    copy: "Copiar JSON",
    build: (key: string) =>
      JSON.stringify({ mcpServers: { "v4-dashboard": { type: "http", url: MCP_URL, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
  },
};
type Tab = keyof typeof SNIPPETS;

function CopyButton({ text, children, className }: { text: string; children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("O navegador bloqueou a cópia. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={children ? undefined : "Copiar"}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-white/15 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        copied && "border-emerald-400/50 text-emerald-300",
        className,
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {children && (copied ? "Copiado" : children)}
      <span className="sr-only" aria-live="polite">{copied ? "Copiado" : ""}</span>
    </button>
  );
}

// Fundo escuro de propósito: é o único bloco da página feito para ser copiado para um terminal.
export function McpCard() {
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [tab, setTab] = useState<Tab>("claude");

  // Sem cache de propósito: o cache das telas vai para o sessionStorage e a chave não expira.
  useEffect(() => {
    getMcpConfig()
      .then((config) => setApiKey(config.apiKey))
      .catch((error: Error) => {
        setApiKey(null);
        toast.error(error.message);
      });
  }, []);

  const key = apiKey ?? PLACEHOLDER;
  const shownKey = apiKey && !revealed ? mask(apiKey) : key;
  const snippet = SNIPPETS[tab];

  return (
    <section className="overflow-hidden rounded-lg border border-[#171717] bg-[#171717] text-white shadow-panel" aria-labelledby="mcp-title">
      <div className="space-y-1.5 p-5">
        <h3 id="mcp-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight"><TerminalSquare className="h-5 w-5 text-primary" />Servidor MCP</h3>
        <p className="max-w-xl text-sm leading-6 text-white/60">
          Conecte o Claude, o Cursor ou outro cliente MCP aos dados do painel: métricas, kanban, Meta Ads e Google Ads.
        </p>
      </div>

      <dl className="grid gap-px border-y border-white/10 bg-white/10 sm:grid-cols-2">
        <div className="flex items-center gap-3 bg-[#171717] px-5 py-4">
          <div className="min-w-0 flex-1">
            <dt className="text-xs text-white/50">Endereço</dt>
            <dd className="mt-1 truncate font-mono text-sm">{MCP_URL}</dd>
          </div>
          <CopyButton text={MCP_URL} />
        </div>
        <div className="flex items-center gap-2 bg-[#171717] px-5 py-4">
          <div className="min-w-0 flex-1">
            <dt className="text-xs text-white/50">Chave de API</dt>
            <dd className={cn("mt-1 truncate font-mono text-sm", !apiKey && "text-white/40")}>
              {apiKey === undefined ? <span className="inline-block h-4 w-40 animate-pulse rounded bg-white/10 align-middle" /> : apiKey ? shownKey : "não definida"}
            </dd>
          </div>
          {apiKey && (
            <>
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? "Ocultar chave" : "Mostrar chave"}
                aria-pressed={revealed}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/15 text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <CopyButton text={apiKey} />
            </>
          )}
        </div>
      </dl>

      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Formato da configuração" className="flex gap-1 rounded-md bg-white/5 p-1">
            {(Object.keys(SNIPPETS) as Tab[]).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  tab === id ? "bg-white text-[#171717]" : "text-white/60 hover:text-white",
                )}
              >
                {SNIPPETS[id].label}
              </button>
            ))}
          </div>
          <CopyButton text={snippet.build(key)} className="border-primary bg-primary hover:bg-primary/90">{snippet.copy}</CopyButton>
        </div>

        <pre role="tabpanel" className="mt-3 overflow-x-auto rounded-md border border-white/10 bg-black/40 p-4 font-mono text-[12.5px] leading-6 text-white/85">
          {tab === "claude" && <span className="select-none text-primary">$ </span>}
          {snippet.build(shownKey)}
        </pre>

        <p className="mt-3 text-xs leading-5 text-white/50">
          {apiKey === null
            ? <>Defina <code className="font-mono text-white/80">MCP_API_KEY</code> no backend para ter uma chave fixa. Sem ela, troque {PLACEHOLDER} pelo seu token de login, que expira em 7 dias.</>
            : "A cópia já leva a chave completa. Ela lê e altera métricas e o kanban: guarde como uma senha."}
        </p>
      </div>
    </section>
  );
}
