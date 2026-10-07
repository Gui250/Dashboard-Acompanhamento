"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BarChart3, Blocks, ChevronDown, ChevronRight, LayoutDashboard, LogOut, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { AssistantBubble } from "@/components/dashboard/assistant-bubble";

const navigation = [
  { href: "/comercial", label: "Comercial", helper: "Receita & vendas", icon: BarChart3 },
  { href: "/operacional", label: "Operacional", helper: "Contas & entregas", icon: LayoutDashboard },
  { href: "/kanban", label: "Kanban", helper: "Esteira criativa", icon: Blocks },
  { href: "/integracoes", label: "Integrações", helper: "OpenAI & conexões", icon: Plug },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const isLogin = pathname === "/login";
  const current = navigation.find((item) => pathname.startsWith(item.href)) ?? navigation[0];

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLogin) router.replace("/login");
    if (user && isLogin) router.replace("/comercial");
  }, [isLoading, isLogin, router, user]);

  if (isLoading || (!user && !isLogin) || (user && isLogin)) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#171717]">
        <div className="flex flex-col items-center gap-4 text-white">
          <Image src="/v4-logo.png" width={48} height={48} alt="V4 Company" className="animate-pulse rounded-xl" priority />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Preparando seu painel</span>
        </div>
      </div>
    );
  }

  if (isLogin) return <>{children}</>;

  const initials = user?.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "V4";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r bg-[#171717] text-white lg:flex">
        <div className="flex h-24 items-center gap-3 border-b border-white/10 px-6">
          <Image src="/v4-logo.png" width={42} height={42} alt="V4 Company" className="rounded-[10px]" priority />
          <div>
            <div className="font-display text-[17px] font-bold uppercase tracking-[0.08em]">V4 Dashboard</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Growth command</div>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">Sessões</p>
          <nav className="mt-3 space-y-1.5">
            {navigation.map(({ href, label, helper, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn("group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "bg-white text-[#171717]" : "text-white/68 hover:bg-white/[0.07] hover:text-white")}
                >
                  <span className={cn("grid h-8 w-8 place-items-center rounded-md", active ? "bg-primary text-white" : "bg-white/[0.07]")}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className={cn("block truncate text-[10px]", active ? "text-neutral-500" : "text-white/35")}>{helper}</span>
                  </span>
                  <ChevronRight className={cn("h-4 w-4", active ? "text-primary" : "opacity-0 transition-opacity group-hover:opacity-60")} />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/10 p-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Painel em operação</div>
            <p className="mt-2 text-[10px] leading-4 text-white/40">Dados sincronizados pela API de métricas.</p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
            <div className="flex items-center gap-3">
              <Image src="/v4-logo.png" width={34} height={34} alt="V4 Company" className="rounded-lg lg:hidden" priority />
              <div>
                <p className="data-label hidden sm:block">Visão executiva</p>
                <h1 className="font-display text-lg font-bold tracking-tight lg:text-xl">{current.label}</h1>
              </div>
            </div>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <div className="hidden text-right sm:block">
                  <p className="max-w-44 truncate text-xs font-semibold">{user?.name}</p>
                  <p className="max-w-44 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{user?.email}</p>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#171717] text-[10px] font-bold text-white">{initials}</div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180 sm:block" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-lg border bg-white p-2 shadow-xl">
                <div className="border-b px-2 py-2 sm:hidden"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div>
                <button type="button" onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <LogOut className="h-4 w-4" />Sair do dashboard
                </button>
              </div>
            </details>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={cn("flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold", pathname.startsWith(href) ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>
                <Icon className="h-3.5 w-3.5" />{label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="grid-paper min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <AssistantBubble />
    </div>
  );
}
