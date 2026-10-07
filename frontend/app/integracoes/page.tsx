"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageIntro } from "@/components/dashboard/dashboard-parts";
import { MetaIntegrationCard } from "@/components/dashboard/meta-integration-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOpenAIConfig, listOpenAIModels, saveOpenAIConfig, type OpenAIConfig } from "@/lib/api";

export default function IntegracoesPage() {
  const [config, setConfig] = useState<OpenAIConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getOpenAIConfig()
      .then((current) => {
        setConfig(current);
        if (!current.configured) return;
        setModel(current.model ?? "");
        return listOpenAIModels().then(setModels);
      })
      .catch((error: Error) => toast.error(error.message));
  }, []);

  // Busca os modelos da chave digitada (e já valida a chave).
  async function loadModels() {
    setBusy(true);
    try {
      const list = await listOpenAIModels(apiKey || undefined);
      setModels(list);
      if (!list.includes(model)) setModel(list.find((id) => id.includes("mini")) ?? list[0] ?? "");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      setConfig(await saveOpenAIConfig({ apiKey: apiKey || undefined, model }));
      setApiKey("");
      toast.success("Integração OpenAI salva.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <PageIntro
        eyebrow="Integrações"
        title="Conecte as ferramentas do painel."
        description="A chave da OpenAI alimenta o assistente de IA. Ela fica cifrada no servidor e nunca volta para o navegador."
        action={null}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />OpenAI</CardTitle>
          <CardDescription>
            {config?.configured ? <>Conectada com a chave <strong className="font-mono">{config.keyHint}</strong> · modelo <strong>{config.model}</strong></> : "Ainda não configurada."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="apiKey">{config?.configured ? "Trocar chave (opcional)" : "Chave da API"}</Label>
              <div className="flex gap-2">
                <Input id="apiKey" type="password" autoComplete="off" placeholder="sk-..." value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())} />
                <Button type="button" variant="outline" onClick={loadModels} disabled={busy || (!apiKey && !config?.configured)}>Buscar modelos</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo do assistente</Label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={models.length === 0}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {models.length === 0 && <option value="">Busque os modelos da sua chave</option>}
                {models.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>

            <Button type="submit" disabled={busy || !model}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar integração</Button>
          </form>
        </CardContent>
      </Card>

      <MetaIntegrationCard />
    </div>
  );
}
