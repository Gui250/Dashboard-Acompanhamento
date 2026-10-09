"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { FileImage, ImageOff, UploadCloud, X } from "lucide-react";
import { getCreativeImage, type Creative } from "@/lib/api";
import { cn } from "@/lib/utils";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_SLOTS = 3;
const imageUrls = new Map<string, string>();
const imageRequests = new Map<string, Promise<string>>();
let imageSlots = 0;
const imageWaiters: Array<() => void> = [];

function imageKey(creative: Pick<Creative, "id" | "updatedAt">) {
  return `${creative.id}:${creative.updatedAt}`;
}

function takeImageSlot() {
  if (imageSlots < IMAGE_SLOTS) {
    imageSlots += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => imageWaiters.push(resolve));
}

function freeImageSlot() {
  imageSlots -= 1;
  const next = imageWaiters.shift();
  if (!next) return;
  imageSlots += 1;
  next();
}

function loadCreativeImage(creative: Pick<Creative, "id" | "updatedAt">) {
  const key = imageKey(creative);
  const cached = imageUrls.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = imageRequests.get(key);
  if (pending) return pending;
  const request = takeImageSlot()
    .then(() => getCreativeImage(creative.id))
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      imageUrls.set(key, url);
      return url;
    })
    .finally(() => {
      imageRequests.delete(key);
      freeImageSlot();
    });
  imageRequests.set(key, request);
  return request;
}

export function validateCreativeImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Use uma imagem PNG, JPG, WEBP ou GIF. Arquivos SVG não são permitidos.";
  if (file.size > MAX_IMAGE_SIZE) return "A imagem deve ter no máximo 5 MB.";
  return null;
}

export function ProtectedCreativeImage({ creative, className, fit = "cover" }: { creative: Creative; className?: string; fit?: "cover" | "contain" }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cached = imageUrls.get(imageKey(creative)) ?? null;
  const [visible, setVisible] = useState(Boolean(cached));
  const [url, setUrl] = useState<string | null>(cached);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setVisible(true);
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!creative.hasImage) {
      setUrl(null);
      setFailed(false);
      return;
    }
    if (!visible) return;
    const hit = imageUrls.get(imageKey(creative));
    if (hit) {
      setUrl(hit);
      setFailed(false);
      return;
    }
    let active = true;
    setFailed(false);
    loadCreativeImage(creative)
      .then((next) => { if (active) setUrl(next); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [creative, visible]);

  return (
    <div ref={hostRef} className={cn("overflow-hidden bg-muted", className)}>
      {url && !failed ? <img src={url} alt={`Criativo ${creative.title}`} className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover")} draggable={false} decoding="async" /> : failed ? (
        <div className="grid h-full place-items-center text-muted-foreground"><ImageOff className="h-5 w-5" /><span className="sr-only">Imagem indisponível</span></div>
      ) : <div className="h-full w-full animate-pulse" aria-label="Carregando imagem" />}
    </div>
  );
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
