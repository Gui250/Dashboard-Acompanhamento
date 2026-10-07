"use client";

import { useId } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const stageOptions = [
  { value: "briefing", label: "Briefing" },
  { value: "producao", label: "Produção" },
  { value: "revisao", label: "Revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "publicado", label: "Publicado" },
] as const;

export const formatOptions = ["Carrossel", "Reels", "Stories", "Estático", "Vídeo"];

export const creativeFormSchema = z.object({
  title: z.string().trim().min(1, "Informe o título."),
  account: z.string().trim().min(1, "Informe a conta."),
  format: z.string().trim().min(1, "Informe o formato."),
  owner: z.string().trim().min(1, "Informe o responsável."),
  stage: z.enum(["briefing", "producao", "revisao", "aprovado", "publicado"]),
});

export type CreativeFormValues = z.infer<typeof creativeFormSchema>;

export function CreativeFormFields({ register, errors }: { register: UseFormRegister<CreativeFormValues>; errors: FieldErrors<CreativeFormValues> }) {
  const id = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Título" error={errors.title?.message} className="sm:col-span-2">
        <Input id={`${id}-title`} placeholder="Ex.: Campanha de lançamento" {...register("title")} />
      </FormField>
      <FormField label="Conta" error={errors.account?.message}>
        <Input id={`${id}-account`} placeholder="Nome da conta" {...register("account")} />
      </FormField>
      <FormField label="Responsável" error={errors.owner?.message}>
        <Input id={`${id}-owner`} placeholder="Iniciais ou nome" {...register("owner")} />
      </FormField>
      <FormField label="Formato" error={errors.format?.message}>
        <select id={`${id}-format`} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register("format")}>
          {formatOptions.map((format) => <option key={format} value={format}>{format}</option>)}
        </select>
      </FormField>
      <FormField label="Etapa" error={errors.stage?.message}>
        <select id={`${id}-stage`} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register("stage")}>
          {stageOptions.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
        </select>
      </FormField>
    </div>
  );
}

function FormField({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
