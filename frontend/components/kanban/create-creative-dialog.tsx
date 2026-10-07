"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilePlus2, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreativeFormFields, creativeFormSchema, type CreativeFormValues } from "@/components/kanban/creative-form";
import { CreativeImagePicker } from "@/components/kanban/creative-image";
import { createCreative, uploadCreativeImage, type Creative } from "@/lib/api";

const defaults: CreativeFormValues = { title: "", account: "", format: "Carrossel", owner: "", stage: "briefing" };

export function CreateCreativeDialog({ onCreated }: { onCreated: (creative: Creative) => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<CreativeFormValues>({ resolver: zodResolver(creativeFormSchema), defaultValues: defaults });

  function reset() {
    form.reset(defaults);
    setFile(null);
    setApiError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !form.formState.isSubmitting) reset();
  }

  async function submit(values: CreativeFormValues) {
    setApiError(null);
    try {
      let creative = await createCreative(values);
      let imageFailed = false;
      if (file) {
        try {
          creative = await uploadCreativeImage(creative.id, file);
        } catch (reason) {
          imageFailed = true;
          toast.error("Criativo criado sem a imagem", { description: reason instanceof Error ? reason.message : "Envie a imagem novamente nos detalhes." });
        }
      }
      onCreated(creative);
      if (!imageFailed) toast.success("Criativo adicionado à esteira");
      setOpen(false);
      reset();
    } catch (reason) {
      setApiError(reason instanceof Error ? reason.message : "Não foi possível criar o criativo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Novo criativo</Button></DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><FilePlus2 className="h-5 w-5" /></div>
          <DialogTitle>Novo criativo</DialogTitle>
          <DialogDescription>Adicione o trabalho à esteira e, se quiser, já envie a imagem para pré-visualização.</DialogDescription>
        </DialogHeader>
        <form className="mt-2 space-y-5" onSubmit={form.handleSubmit(submit)} noValidate>
          <CreativeFormFields register={form.register} errors={form.formState.errors} />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Imagem <span className="font-normal text-muted-foreground">(opcional)</span></p>
            <CreativeImagePicker file={file} onChange={setFile} />
          </div>
          {apiError && <p role="alert" className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm font-medium text-destructive">{apiError}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={form.formState.isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}Criar criativo</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
