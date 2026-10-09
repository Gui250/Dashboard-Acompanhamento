"use client";

import { Loader2, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@/hooks/use-query";
import { disconnectGoogle, getGoogleAuthUrl, getGoogleConfig, saveGoogleCredentials } from "@/lib/api";
import { setQueryData, touchStale } from "@/lib/query-cache";

const SOURCE = { credenciais: "credenciais coladas aqui", oauth: "login do Google", direto: "credenciais padrão do servidor" };

export function GoogleIntegrationCard() {
  const { data: config, error, refresh } = useQuery("integration:google", getGoogleConfig);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState("");
  const [developerToken, setDeveloperToken] = useState("");

  // Volta do consentimento: o backend redireciona para /integracoes?google=ok|cancelado|erro.
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("google");
    if (!status) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (status === "ok") {
      toast.success("Google Ads conectado.");
      touchStale("google:");
      refresh();
    } else if (status === "cancelado") toast.info("Conexão com o Google cancelada. Nada foi alterado.");
    else toast.error("O Google não confirmou a conexão. Tente conectar de novo.");
  }, [refresh]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // O navegador sai do app e volta pelo callback; busy fica ligado até a página trocar.
  async function connect() {
    setBusy(true);
    try {
      const { url } = await getGoogleAuthUrl();
      window.location.assign(url);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  async function run(action: () => ReturnType<typeof getGoogleConfig>, success: string) {
    setBusy(true);
    try {
      setQueryData("integration:google", await action());
      touchStale("google:");
      setCredentials("");
      setDeveloperToken("");
      toast.success(success);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void run(() => saveGoogleCredentials({ credentials: credentials || undefined, developerToken: developerToken || undefined }), "Credenciais do Google salvas.");
  }

  const connected = !!config?.source;
  const ready = connected && config.developerToken;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MousePointerClick className="h-5 w-5 text-primary" />Google Ads</CardTitle>
        <CardDescription>
          {!config ? "Verificando conexão…"
            : connected ? <>Conectado via {SOURCE[config.source!]}{config.email && <> como <strong>{config.email}</strong></>}</>
            : "O servidor não conseguiu se conectar ao Google sozinho. Informe as credenciais abaixo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {config && !config.developerToken && (
          <p className="text-sm leading-6 text-muted-foreground">Falta o developer token do Google Ads (Central de API da conta administradora).</p>
        )}
        {ready && (
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link href="/operacional">Ver contas</Link></Button>
            {config.source !== "direto" && (
              <Button variant="outline" disabled={busy} onClick={() => run(disconnectGoogle, "Conexão removida.")}>Desconectar</Button>
            )}
          </div>
        )}
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="googleCredentials">{connected ? "Trocar credenciais (opcional)" : "JSON de credenciais do Google"}</Label>
            <textarea
              id="googleCredentials"
              rows={4}
              spellCheck={false}
              autoComplete="off"
              placeholder='{"type": "service_account", "client_email": "...", "private_key": "..."}'
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              className="flex w-full rounded-md border border-input bg-white px-3 py-2 font-mono text-xs outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
            />
            <p className="text-xs leading-5 text-muted-foreground">Chave JSON de uma conta de serviço do Google Cloud. Adicione o e-mail dela como usuário na conta do Google Ads.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="googleDevToken">{config?.developerToken ? "Trocar developer token (opcional)" : "Developer token"}</Label>
            <Input id="googleDevToken" type="password" autoComplete="off" value={developerToken} onChange={(e) => setDeveloperToken(e.target.value.trim())} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || (!credentials.trim() && !developerToken)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar credenciais
            </Button>
            {config?.oauth && (
              <Button type="button" variant="outline" onClick={connect} disabled={busy}>
                {config.source === "oauth" ? "Conectar outra conta Google" : "Conectar com o Google"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
