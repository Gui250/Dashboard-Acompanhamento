"use client";

import { Loader2, Pencil, Plus, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFunnel, deleteFunnel, updateFunnel, type Funnel } from "@/lib/api";
import { cn } from "@/lib/utils";

// Um botão por funil (kanban separado), editar o funil aberto e criar funil novo.
export function FunnelTabs({ funnels, value, onChange, onCreated, onUpdated, onDeleted }: {
  funnels: Funnel[];
  value: number | null;
  onChange: (id: number) => void;
  onCreated: (funnel: Funnel) => void;
  onUpdated: (funnel: Funnel) => void;
  onDeleted: (id: number) => void;
}) {
  const current = funnels.find((f) => f.id === value);
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
          {funnel.isDefault && <Star className="mr-1 inline h-3.5 w-3.5 -translate-y-px fill-current" aria-label="Padrão" />}
          {funnel.name}
        </button>
      ))}
      {current && <EditFunnelDialog key={current.id} funnel={current} onUpdated={onUpdated} onDeleted={onDeleted} />}
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

function EditFunnelDialog({ funnel, onUpdated, onDeleted }: { funnel: Funnel; onUpdated: (funnel: Funnel) => void; onDeleted: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(funnel.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) { setName(funnel.name); setError(null); setConfirmDelete(false); }
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  const rename = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      onUpdated(await updateFunnel(funnel.id, { name: name.trim() }));
      setOpen(false);
      toast.success("Funil renomeado.");
    }, "Não foi possível renomear o funil.");
  };

  const makeDefault = () => run(async () => {
    onUpdated(await updateFunnel(funnel.id, { isDefault: true }));
    toast.success(`"${funnel.name}" agora é o funil padrão.`);
  }, "Não foi possível definir o padrão.");

  const remove = () => run(async () => {
    const { moved } = await deleteFunnel(funnel.id);
    setOpen(false);
    onDeleted(funnel.id);
    toast.success(moved ? `Funil excluído. ${moved} criativo(s) foram para o funil padrão.` : "Funil excluído.");
  }, "Não foi possível excluir o funil.");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild><Button size="sm" variant="ghost" aria-label={`Editar o funil ${funnel.name}`}><Pencil className="h-4 w-4" />Editar funil</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar funil</DialogTitle>
          <DialogDescription>{funnel.isDefault ? "Este é o funil padrão: abre primeiro para todos e recebe os criativos sem funil." : "Renomeie, torne padrão ou exclua este funil."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={rename} className="mt-2 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editFunnelName">Nome</Label>
            <Input id="editFunnelName" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !name.trim() || name.trim() === funnel.name}>Salvar nome</Button>
          </div>
        </form>
        {!funnel.isDefault && (
          <div className="mt-2 space-y-3 border-t pt-4">
            <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void makeDefault()}><Star className="h-4 w-4" />Tornar funil padrão</Button>
            {confirmDelete ? (
              <div className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
                <p>Excluir <strong>{funnel.name}</strong>? Os criativos dele vão para o funil padrão.</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void remove()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Excluir funil</Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>Excluir funil</Button>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
