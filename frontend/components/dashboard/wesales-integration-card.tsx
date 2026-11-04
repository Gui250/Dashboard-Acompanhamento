"use client";

import { Handshake, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWesalesConfig, saveWesalesConfig, type WesalesConfig } from "@/lib/api";
import { touchStale } from "@/lib/query-cache";

export function WesalesIntegrationCard() {
  const [config, setConfig] = useState<WesalesConfig | null>(null);
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getWesalesConfig()
      .then((current) => {
        setConfig(current);
        setLocationId(current.locationId ?? "");
      })
      .catch((error: Error) => toast.error(error.message));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await saveWesalesConfig({ token: token || undefined, locationId });
      setConfig(saved);
      setLocationId(saved.locationId ?? locationId);
      setToken("");
      touchStale("wesales:"); // o Comercial busca de novo com a conta nova
      toast.success("Integração WeSales salva.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Handshake className="h-5 w-5 text-primary" />WeSales</CardTitle>
        <CardDescription>
          {config?.configured ? <>Conectado à subconta <strong>{config.locationName}</strong> ({config.locationId})</> : "Ainda não configurado."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="wesalesToken">{config?.configured ? "Trocar token (opcional)" : "Token de integração privada"}</Label>
            <Input id="wesalesToken" type="password" autoComplete="off" placeholder="pit-..." value={token} onChange={(e) => setToken(e.target.value.trim())} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wesalesLocation">Location ID da subconta</Label>
            <Input id="wesalesLocation" autoComplete="off" placeholder="30P89HtRWspWhO9ZC11d" value={locationId} onChange={(e) => setLocationId(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} />
          </div>
          <Button type="submit" disabled={busy || !locationId || (!config?.configured && !token)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar integração
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
