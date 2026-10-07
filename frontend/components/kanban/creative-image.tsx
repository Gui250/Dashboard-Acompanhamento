"use client";

import { useEffect, useId, useState, type DragEvent } from "react";
import { FileImage, ImageOff, UploadCloud, X } from "lucide-react";
import { getCreativeImage, type Creative } from "@/lib/api";
import { cn } from "@/lib/utils";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function validateCreativeImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Use uma imagem PNG, JPG, WEBP ou GIF. Arquivos SVG não são permitidos.";
  if (file.size > MAX_IMAGE_SIZE) return "A imagem deve ter no máximo 5 MB.";
  return null;
}

export function ProtectedCreativeImage({ creative, className }: { creative: Creative; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(creative.hasImage);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);

    if (!creative.hasImage) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    getCreativeImage(creative.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [creative.hasImage, creative.id, creative.updatedAt]);

  if (isLoading) return <div className={cn("animate-pulse bg-muted", className)} aria-label="Carregando imagem" />;
  if (!url || failed) return <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}><ImageOff className="h-5 w-5" /><span className="sr-only">Imagem indisponível</span></div>;
  return <img src={url} alt={`Criativo ${creative.title}`} className={cn("object-cover", className)} draggable={false} />;
}

export function CreativeImagePicker({ file, onChange, label = "Adicionar imagem" }: { file: File | null; onChange: (file: File | null) => void; label?: string }) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(nextFile?: File) {
    setError(null);
    if (!nextFile) return;
    const validationError = validateCreativeImage(nextFile);
    if (validationError) {
      setError(validationError);
      onChange(null);
      return;
    }
    onChange(nextFile);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  return (
    <div>
      <div
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={drop}
        className={cn("rounded-lg border-2 border-dashed p-4 transition-colors", isDragging ? "border-primary bg-primary/[0.04]" : "border-border bg-muted/35")}
      >
        <input id={inputId} type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => choose(event.target.files?.[0])} />
        {file ? (
          <div className="flex items-center gap-3 rounded-md border bg-white p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><FileImage className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{file.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · pronta para enviar</p></div>
            <button type="button" aria-label="Remover imagem selecionada" onClick={() => onChange(null)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label htmlFor={inputId} className="flex cursor-pointer items-center justify-center gap-3 py-3 text-center">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm"><UploadCloud className="h-4 w-4" /></span>
            <span className="text-left"><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Arraste ou selecione · PNG, JPG, WEBP ou GIF · até 5 MB</span></span>
          </label>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
