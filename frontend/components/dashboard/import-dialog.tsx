"use client";

import { useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, API_URL, importMetrics, type ImportLineError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function ImportDialog({ onImported }: { onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<ImportLineError[]>([]);
  const [imported, setImported] = useState<number | null>(null);

  function resetFeedback() {
    setMessage(null);
    setLineErrors([]);
    setImported(null);
  }

  function selectFile(nextFile?: File) {
    resetFeedback();
    if (!nextFile) return;
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx" && extension !== "csv") {
      setMessage("Selecione um arquivo .xlsx ou .csv.");
      setFile(null);
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setMessage("O arquivo deve ter no máximo 5 MB.");
      setFile(null);
      return;
    }
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function upload() {
    if (!file) {
      setMessage("Escolha uma planilha antes de importar.");
      return;
    }
    setIsUploading(true);
    resetFeedback();
    try {
      const result = await importMetrics(file);
      setImported(result.imported);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`${result.imported} ${result.imported === 1 ? "métrica importada" : "métricas importadas"}`);
      onImported();
    } catch (reason) {
      if (reason instanceof ApiError) {
        setMessage(reason.message);
        setLineErrors(reason.errors);
      } else {
        setMessage(reason instanceof Error ? reason.message : "Não foi possível importar a planilha.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !isUploading) {
      setFile(null);
      resetFeedback();
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild><Button variant="outline"><UploadCloud className="h-4 w-4" />Importar planilha</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><FileSpreadsheet className="h-5 w-5" /></div>
          <DialogTitle>Importar métricas</DialogTitle>
          <DialogDescription>Envie uma planilha no modelo V4. A importação só é concluída quando todas as linhas estão válidas.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`${API_URL}/metrics/template`} download className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Download className="h-3.5 w-3.5" />Baixar modelo .xlsx</a>
          <a href={`${API_URL}/metrics/template?format=csv`} download className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Download className="h-3.5 w-3.5" />Baixar modelo .csv</a>
        </div>

        <div
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn("mt-2 rounded-lg border-2 border-dashed p-7 text-center transition-colors", isDragging ? "border-primary bg-primary/[0.04]" : "border-border bg-muted/35")}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="sr-only" id="metrics-file" onChange={(event) => selectFile(event.target.files?.[0])} />
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border bg-white p-3 text-left shadow-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · pronto para importar</p></div>
              <button type="button" aria-label="Remover arquivo" onClick={() => setFile(null)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-primary shadow-sm"><UploadCloud className="h-5 w-5" /></span>
              <p className="mt-4 text-sm font-semibold">Arraste sua planilha para cá</p>
              <p className="mt-1 text-xs text-muted-foreground">ou selecione um arquivo .xlsx ou .csv de até 5 MB</p>
              <label htmlFor="metrics-file" className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-4 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 focus-within:ring-2 focus-within:ring-ring">Selecionar arquivo</label>
            </>
          )}
        </div>

        {imported !== null && (
          <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{imported} {imported === 1 ? "métrica importada" : "métricas importadas"}</p><p className="mt-0.5 text-xs text-emerald-800">Os indicadores da tela já foram atualizados.</p></div></div>
        )}

        {message && (
          <div role="alert" className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
            <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="font-semibold">{message}</p></div>
            {lineErrors.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto border-t border-primary/10 pt-2">
                <ul className="space-y-1.5">
                  {lineErrors.map((error, index) => <li key={`${error.line}-${index}`} className="flex gap-3 text-xs"><span className="shrink-0 font-mono font-bold text-primary">Linha {error.line}</span><span className="text-muted-foreground">{error.message}</span></li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isUploading}>Fechar</Button>
          <Button type="button" onClick={upload} disabled={!file || isUploading}>{isUploading && <Loader2 className="h-4 w-4 animate-spin" />}Importar métricas</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
