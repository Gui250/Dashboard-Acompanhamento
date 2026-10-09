"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFunnel, type Funnel } from "@/lib/api";
import { cn } from "@/lib/utils";

// Um botão por funil (kanban separado) + criar funil novo.
export function FunnelTabs({ funnels, value, onChange, onCreated }: {
  funnels: Funnel[];
  value: number | null;
  onChange: (id: number) => void;
  onCreated: (funnel: Funnel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const funnel = await createFunnel(name.trim());
      onCreated(funnel);
      setOpen(false);
      setName("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o funil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Funis">
      {funnels.map((funnel) => (
        <button
          key={funnel.id}
          type="button"
          role="tab"
          aria-selected={funnel.id === value}
          onClick={() => onChange(funnel.id)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
            funnel.id === value ? "border-foreground bg-foreground text-white" : "bg-white hover:border-foreground/30",
          )}
        >
          {funnel.name}
        </button>
      ))}
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
        <DialogTrigger asChild><Button size="sm" variant="ghost"><Plus className="h-4 w-4" />Novo funil</Button></DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo funil</DialogTitle>
            <DialogDescription>Um kanban separado, com as mesmas etapas, do briefing à publicação.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="mt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="funnelName">Nome</Label>
              <Input id="funnelName" autoFocus maxLength={80} placeholder="Ex.: Cliente X, Lançamento" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={busy || !name.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Criar funil</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
