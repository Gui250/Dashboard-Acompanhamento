"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, BarChart3, Check, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { login, register as registerUser } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128, "A senha deve ter no máximo 128 caracteres."),
});

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1, "Informe seu nome."),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [apiError, setApiError] = useState<string | null>(null);
  const { startSession } = useAuth();
  const router = useRouter();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "" } });

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setApiError(null);
  }

  async function submitLogin(values: LoginValues) {
    setApiError(null);
    try {
      const session = await login(values);
      startSession(session);
      router.replace("/comercial");
    } catch (reason) {
      setApiError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    }
  }

  async function submitRegister(values: RegisterValues) {
    setApiError(null);
    try {
      const session = await registerUser(values);
      startSession(session);
      router.replace("/comercial");
    } catch (reason) {
      setApiError(reason instanceof Error ? reason.message : "Não foi possível criar a conta.");
    }
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(390px,0.82fr)_1.18fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#171717] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="absolute -right-28 top-0 h-[140%] w-56 -translate-y-20 rotate-[17deg] bg-primary" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/v4-logo.png" width={46} height={46} alt="V4 Company" className="rounded-[11px]" priority />
          <div><p className="font-display text-lg font-bold uppercase tracking-[0.08em]">V4 Dashboard</p><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Growth command</p></div>
        </div>

        <div className="relative z-10 my-auto max-w-lg py-16">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Performance em movimento</p>
          <h1 className="mt-5 max-w-md font-display text-6xl font-black uppercase leading-[0.88] tracking-[-0.055em] xl:text-7xl">Resultado<br />não é<br />acaso.</h1>
          <p className="mt-7 max-w-sm text-sm leading-6 text-white/55">Acesse a visão comercial, acompanhe a operação e mova a esteira criativa em um único lugar.</p>
          <div className="mt-10 grid max-w-sm gap-3">
            {["Indicadores em tempo real", "Dados protegidos por usuário", "Decisões com contexto"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-xs font-semibold text-white/70"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/10"><Check className="h-3 w-3 text-primary" /></span>{item}</div>
            ))}
          </div>
        </div>
        <p className="relative z-10 font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">V4 Company · Central de performance</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image src="/v4-logo.png" width={42} height={42} alt="V4 Company" className="rounded-[10px]" priority />
            <div><p className="font-display text-base font-bold uppercase tracking-[0.08em]">V4 Dashboard</p><p className="font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Growth command</p></div>
          </div>

          <div className="mb-8">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary"><BarChart3 className="h-5 w-5" /></div>
            <p className="data-label text-primary">Acesso seguro</p>
            <h2 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.04em]">{mode === "login" ? "Entre no painel." : "Crie seu acesso."}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Use seu e-mail e senha para continuar." : "Preencha seus dados para começar a acompanhar a operação."}</p>
          </div>

          <div className="mb-7 grid grid-cols-2 rounded-lg bg-muted p-1" role="tablist" aria-label="Acesso à conta">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => changeMode("login")} className={cn("rounded-md px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mode === "login" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Entrar</button>
            <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => changeMode("register")} className={cn("rounded-md px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", mode === "register" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Criar conta</button>
          </div>

          {apiError && <div role="alert" className="mb-5 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.045] px-4 py-3 text-sm"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{apiError}</span></div>}

          {mode === "login" ? (
            <form className="space-y-5" onSubmit={loginForm.handleSubmit(submitLogin)} noValidate>
              <FormField label="E-mail" error={loginForm.formState.errors.email?.message}><Input type="email" autoComplete="email" placeholder="voce@empresa.com" {...loginForm.register("email")} /></FormField>
              <FormField label="Senha" error={loginForm.formState.errors.password?.message}><Input type="password" autoComplete="current-password" placeholder="Mínimo de 8 caracteres" {...loginForm.register("password")} /></FormField>
              <Button className="h-11 w-full" type="submit" disabled={loginForm.formState.isSubmitting}>{loginForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Entrar no dashboard</Button>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={registerForm.handleSubmit(submitRegister)} noValidate>
              <FormField label="Nome" error={registerForm.formState.errors.name?.message}><Input autoComplete="name" placeholder="Seu nome" {...registerForm.register("name")} /></FormField>
              <FormField label="E-mail" error={registerForm.formState.errors.email?.message}><Input type="email" autoComplete="email" placeholder="voce@empresa.com" {...registerForm.register("email")} /></FormField>
              <FormField label="Senha" error={registerForm.formState.errors.password?.message}><Input type="password" autoComplete="new-password" placeholder="Entre 8 e 128 caracteres" {...registerForm.register("password")} /></FormField>
              <Button className="h-11 w-full" type="submit" disabled={registerForm.formState.isSubmitting}>{registerForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Criar conta e entrar</Button>
            </form>
          )}

          <p className="mt-7 text-center text-xs leading-5 text-muted-foreground">Ao continuar, sua sessão ficará ativa neste dispositivo por até 7 dias.</p>
        </div>
      </section>
    </main>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
