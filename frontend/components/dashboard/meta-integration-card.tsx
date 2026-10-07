"use client";

import { Loader2, Megaphone } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMetaConfig, saveMetaConfig, type MetaConfig } from "@/lib/api";

export function MetaIntegrationCard() {
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMetaConfig()
      .then((current) => {
        setConfig(current);
        setBusinessId(current.businessId ?? "");
      })
      .catch((error: Error) => toast.error(error.message));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveMetaConfig({ accessToken: accessToken || undefined, businessId });
      setConfig(saved);
      setBusinessId(saved.businessId ?? businessId);
      setAccessToken("");
      toast.success("Integração Meta Ads salva.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />Meta Ads</CardTitle>
        <CardDescription>
          {config?.configured ? <>Conectada à BM <strong>{config.businessName}</strong> ({config.businessId})</> : "Ainda não configurada."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="metaToken">{config?.configured ? "Trocar token de acesso (opcional)" : "Token de acesso (System User)"}</Label>
            <Input id="metaToken" type="password" autoComplete="off" placeholder="EAA..." value={accessToken} onChange={(e) => setAccessToken(e.target.value.trim())} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaBusinessId">ID da Business Manager</Label>
            <Input id="metaBusinessId" inputMode="numeric" autoComplete="off" placeholder="123456789012345" value={businessId} onChange={(e) => setBusinessId(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Button type="submit" disabled={busy || !businessId || (!config?.configured && !accessToken)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar integração
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
