"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createMetric, type MetricSection } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const metricSchema = z.object({
  key: z.string().min(1, "Escolha um indicador."),
  dimension: z.string().trim().optional(),
  value: z.coerce.number({ invalid_type_error: "Informe um valor válido." }).finite().nonnegative("Use um valor maior ou igual a zero."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida."),
});

type MetricForm = z.infer<typeof metricSchema>;

const options: Record<MetricSection, { value: string; label: string; dimension: string }[]> = {
  comercial: [
    { value: "vendas", label: "Vendas", dimension: "Nome do vendedor" },
    { value: "faturamento", label: "Faturamento", dimension: "Vendedor ou canal (opcional)" },
    { value: "leads", label: "Leads", dimension: "Origem ou vendedor (opcional)" },
    { value: "taxa_conversao", label: "Taxa de conversão", dimension: "Time ou vendedor (opcional)" },
  ],
  operacional: [
    { value: "criativos_em_esteira", label: "Criativos em esteira", dimension: "Conta ou responsável (opcional)" },
    { value: "contas_ativas", label: "Contas ativas", dimension: "Nome da conta / lead" },
  ],
};

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function MetricDialog({ section, onCreated }: { section: MetricSection; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<MetricForm>({
    resolver: zodResolver(metricSchema),
    defaultValues: { key: options[section][0].value, dimension: "", value: 0, date: today() },
  });
  const selected = options[section].find((item) => item.value === watch("key")) ?? options[section][0];

  async function onSubmit(values: MetricForm) {
    try {
      await createMetric({
        section,
        key: values.key,
        ...(values.dimension ? { dimension: values.dimension } : {}),
        value: values.value,
        date: values.date,
      });
      toast.success("Métrica registrada", { description: "O painel já foi atualizado com o novo lançamento." });
      reset({ key: options[section][0].value, dimension: "", value: 0, date: today() });
      setOpen(false);
      onCreated();
    } catch (reason) {
      toast.error("Não foi possível registrar", { description: reason instanceof Error ? reason.message : "Tente novamente." });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" />Lançar métrica</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
          <DialogTitle>Novo lançamento</DialogTitle>
          <DialogDescription>Registre um indicador de {section}. Os dados serão enviados diretamente para a API.</DialogDescription>
        </DialogHeader>
        <form className="mt-2 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor={`${section}-key`}>Indicador</Label>
            <select id={`${section}-key`} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" {...register("key")}>
              {options[section].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {errors.key && <p className="text-xs font-medium text-destructive">{errors.key.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${section}-dimension`}>Dimensão</Label>
            <Input id={`${section}-dimension`} placeholder={selected.dimension} {...register("dimension")} />
            <p className="text-[11px] text-muted-foreground">Use a dimensão para rankings e agrupamentos.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${section}-value`}>Valor</Label>
              <Input id={`${section}-value`} type="number" min="0" step="any" inputMode="decimal" {...register("value")} />
              {errors.value && <p className="text-xs font-medium text-destructive">{errors.value.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${section}-date`}>Data</Label>
              <Input id={`${section}-date`} type="date" {...register("date")} />
              {errors.date && <p className="text-xs font-medium text-destructive">{errors.date.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar lançamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
