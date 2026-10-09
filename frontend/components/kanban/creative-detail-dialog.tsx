"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, ImageMinus, Loader2, Maximize2, MessageSquareWarning, Save, Send, Trash2, UploadCloud } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreativeFormFields, creativeFormSchema, stageOptions, type CreativeFormValues } from "@/components/kanban/creative-form";
import { CreativeImagePicker, ProtectedCreativeImage } from "@/components/kanban/creative-image";
import { deleteCreative, removeCreativeImage, sendCreativeForApproval, updateCreative, uploadCreativeImage, type Creative } from "@/lib/api";

type Props = {
  creative: Creative;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (creative: Creative) => void;
  onDeleted: (id: number) => void;
};

export function CreativeDetailDialog({ creative, open, onOpenChange, onUpdated, onDeleted }: Props) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isImageBusy, setIsImageBusy] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const form = useForm<CreativeFormValues>({
    resolver: zodResolver(creativeFormSchema),
    defaultValues: valuesFromCreative(creative),
  });

  useEffect(() => {
    form.reset(valuesFromCreative(creative));
    setImageFile(null);
    setActionError(null);
  }, [creative, form]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (form.formState.isSubmitting || isImageBusy || isDeleting || isSending)) return;
    if (!nextOpen) {
      setConfirmDelete(false);
      setImageFile(null);
      setActionError(null);
    }
    onOpenChange(nextOpen);
  }

  async function save(values: CreativeFormValues) {
    setActionError(null);
    try {
      const updated = await updateCreative(creative.id, values);
      onUpdated(updated);
      toast.success("Criativo atualizado");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível salvar as alterações.");
    }
  }

  async function uploadImage() {
    if (!imageFile) return;
    setIsImageBusy(true);
    setActionError(null);
    try {
      const updated = await uploadCreativeImage(creative.id, imageFile);
      onUpdated(updated);
      setImageFile(null);
      toast.success(creative.hasImage ? "Imagem substituída" : "Imagem adicionada");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível enviar a imagem.");
    } finally {
      setIsImageBusy(false);
    }
  }

  async function removeImage() {
    setIsImageBusy(true);
    setActionError(null);
    try {
      const updated = await removeCreativeImage(creative.id);
      onUpdated(updated);
      setImageFile(null);
      toast.success("Imagem removida");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível remover a imagem.");
    } finally {
      setIsImageBusy(false);
    }
  }

  // E-mail com Aprovar / Pedir ajustes para a aprovadora; o card vai para Revisão.
  async function sendForApproval() {
    setIsSending(true);
    setActionError(null);
    try {
      const updated = await sendCreativeForApproval(creative.id);
      onUpdated(updated);
      toast.success(creative.stage === "revisao" ? "E-mail de aprovação reenviado" : "Enviado para aprovação", { description: "flaviasobral@v4company.com recebeu o criativo para aprovar." });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível enviar para aprovação.");
    } finally {
      setIsSending(false);
    }
  }

  async function removeCreative() {
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteCreative(creative.id);
      onDeleted(creative.id);
      toast.success("Criativo excluído");
      onOpenChange(false);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Não foi possível excluir o criativo.");
    } finally {
      setIsDeleting(false);
    }
  }

  const stageLabel = stageOptions.find((stage) => stage.value === creative.stage)?.label ?? creative.stage;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto p-0">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <section className="border-b bg-[#171717] p-5 text-white lg:min-h-[720px] lg:border-b-0 lg:border-r lg:p-7">
            <div className="flex items-center justify-between gap-3 pr-8">
              <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-white/65">{stageLabel}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/35">Criativo #{creative.id}</span>
            </div>
            <button
              type="button"
              onClick={() => setInspecting(true)}
              disabled={!creative.hasImage}
              aria-label="Inspecionar o criativo em tamanho real"
              className="group relative mt-5 block w-full overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
            >
              <ProtectedCreativeImage creative={creative} className="aspect-[4/3] w-full" />
              {creative.hasImage && <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 className="h-3.5 w-3.5" />Inspecionar</span>}
            </button>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" disabled={!creative.hasImage} onClick={() => setInspecting(true)}><Maximize2 className="h-4 w-4" />Inspecionar</Button>
              <Button type="button" disabled={isSending} onClick={() => void sendForApproval()}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{creative.stage === "revisao" ? "Reenviar aprovação" : "Enviar para aprovação"}
              </Button>
            </div>
            {creative.reviewNote && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
                <p><strong>Ajustes pedidos:</strong> {creative.reviewNote}</p>
              </div>
            )}
            <div className="mt-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Pré-visualização</p>
              <h3 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight">{creative.title}</h3>
              <p className="mt-1 text-sm text-white/50">{creative.account} · {creative.format}</p>
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[10px] text-white/35"><CalendarDays className="h-3.5 w-3.5" />Atualizado em {formatDateTime(creative.updatedAt)}</div>
          </section>

          <section className="p-5 sm:p-7">
            <DialogHeader className="pr-8">
              <DialogTitle>Detalhes do criativo</DialogTitle>
              <DialogDescription>Edite os dados, atualize a imagem ou remova este item da esteira.</DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(save)} noValidate>
              <CreativeFormFields register={form.register} errors={form.formState.errors} />
              <Button type="submit" variant="outline" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar alterações
              </Button>
            </form>

            <div className="mt-6 space-y-3 border-t pt-5">
              <div><p className="text-sm font-semibold">Imagem do criativo</p><p className="mt-1 text-xs text-muted-foreground">O envio substitui automaticamente a imagem atual.</p></div>
              <CreativeImagePicker file={imageFile} onChange={setImageFile} label={creative.hasImage ? "Trocar imagem" : "Enviar imagem"} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={uploadImage} disabled={!imageFile || isImageBusy}>
                  {isImageBusy && imageFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}Enviar imagem
                </Button>
                {creative.hasImage && <Button type="button" size="sm" variant="outline" onClick={removeImage} disabled={isImageBusy}><ImageMinus className="h-4 w-4" />Remover imagem</Button>}
              </div>
            </div>

            {actionError && <p role="alert" className="mt-5 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm font-medium text-destructive">{actionError}</p>}

            <div className="mt-6 border-t pt-5">
              {!confirmDelete ? (
                <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-4 w-4" />Excluir criativo</button>
              ) : (
                <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] p-4">
                  <p className="text-sm font-semibold">Excluir este criativo?</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">O card e sua imagem serão removidos definitivamente.</p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" className="bg-destructive hover:bg-destructive/90" onClick={removeCreative} disabled={isDeleting}>{isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}Excluir definitivamente</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
      <Dialog open={inspecting} onOpenChange={setInspecting}>
        <DialogContent className="max-w-6xl border-0 bg-[#0b0b0b] p-3 text-white sm:p-4">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-base text-white">{creative.title}</DialogTitle>
            <DialogDescription className="text-white/50">{creative.account} · {creative.format}</DialogDescription>
          </DialogHeader>
          <ProtectedCreativeImage creative={creative} fit="contain" className="h-[78vh] w-full rounded-md bg-black" />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function valuesFromCreative(creative: Creative): CreativeFormValues {
  return { title: creative.title, account: creative.account, format: creative.format, owner: creative.owner, stage: creative.stage };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
