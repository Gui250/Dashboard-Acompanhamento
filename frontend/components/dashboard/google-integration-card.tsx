"use client";

import { Loader2, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@/hooks/use-query";
import { getGoogleAuthUrl, getGoogleConfig } from "@/lib/api";
import { touchStale } from "@/lib/query-cache";

export function GoogleIntegrationCard() {
  const { data: config, error, refresh } = useQuery("integration:google", getGoogleConfig);
  const [busy, setBusy] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MousePointerClick className="h-5 w-5 text-primary" />Google Ads</CardTitle>
        <CardDescription>
          {!config ? "Verificando conexão…"
            : !config.enabled ? "Indisponível neste servidor."
            : config.connected ? <>Conectado como <strong>{config.email ?? "conta Google"}</strong></>
            : "Ainda não conectado."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {config && !config.enabled ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Para ativar, defina <code className="font-mono text-xs text-foreground">GOOGLE_CLIENT_ID</code>, <code className="font-mono text-xs text-foreground">GOOGLE_CLIENT_SECRET</code>,{" "}
            <code className="font-mono text-xs text-foreground">GOOGLE_REDIRECT_URI</code> e <code className="font-mono text-xs text-foreground">GOOGLE_ADS_DEVELOPER_TOKEN</code> no backend e reinicie a API.
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {config?.connected
              ? "As contas que esse login acessa aparecem em Operacional. Para usar outro login, conecte de novo."
              : "Entre com a conta Google que acessa o Google Ads. Depois de autorizar, você volta para esta página."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={connect} disabled={busy || !config?.enabled} variant={config?.connected ? "outline" : "default"}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {config?.connected ? "Conectar outra conta" : "Conectar com o Google"}
          </Button>
          {config?.connected && <Button asChild><Link href="/operacional">Ver contas</Link></Button>}
        </div>
      </CardContent>
    </Card>
  );
}
