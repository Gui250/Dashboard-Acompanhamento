"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Blocks,
  Check,
  ChevronRight,
  CircleUserRound,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  Plug,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  createRole,
  deleteRole,
  getGovernance,
  updateRole,
  updateUserRole,
  type GovernanceOverview,
  type Permission,
  type Role,
} from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AccessRow = {
  id: string;
  label: string;
  description: string;
  icon: typeof BarChart3;
  view?: Permission;
  manage: Permission;
};

const accessRows: AccessRow[] = [
  { id: "metrics", label: "Métricas", description: "Comercial e operacional", icon: BarChart3, view: "metrics.view", manage: "metrics.manage" },
  { id: "kanban", label: "Kanban", description: "Esteira e criativos", icon: Blocks, view: "kanban.view", manage: "kanban.manage" },
  { id: "integrations", label: "Integrações", description: "Ads, IA e conexões", icon: Plug, view: "integrations.view", manage: "integrations.manage" },
  { id: "governance", label: "Governança", description: "Cargos e equipe", icon: ShieldCheck, manage: "governance.manage" },
];

const roleTones = [
  "bg-[#171717] text-white",
  "bg-[#e50915] text-white",
  "bg-[#2563eb] text-white",
  "bg-[#d97706] text-white",
  "bg-[#047857] text-white",
];

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function permissionCount(role: Role) {
  return role.permissions.length;
}

function PermissionToggle({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "mx-auto grid h-8 w-8 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        checked ? "border-[#171717] bg-[#171717] text-white" : "border-neutral-300 bg-white text-transparent hover:border-neutral-500",
        disabled && "opacity-55",
      )}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </button>
  );
}

export default function GovernancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<GovernanceOverview | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = data?.roles.find((role) => role.id === selectedId) ?? null;
  const dirty = selected ? JSON.stringify([...draft].sort()) !== JSON.stringify([...selected.permissions].sort()) : false;
  const assigned = useMemo(() => data?.users.filter((member) => member.role.id === selectedId).length ?? 0, [data, selectedId]);

  useEffect(() => {
    let active = true;
    getGovernance()
      .then((overview) => {
        if (!active) return;
        setData(overview);
        setSelectedId(overview.roles[0]?.id ?? null);
        setDraft(overview.roles[0]?.permissions ?? []);
      })
      .catch((reason) => toast.error("Não foi possível carregar a governança", { description: reason instanceof Error ? reason.message : "Tente novamente." }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function selectRole(role: Role) {
    setSelectedId(role.id);
    setDraft(role.permissions);
  }

  function toggle(permission: Permission, row: AccessRow, kind: "view" | "manage") {
    if (selected?.name === "Administrador") return;
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(permission)) {
        next.delete(permission);
        if (kind === "view") next.delete(row.manage);
      } else {
        next.add(permission);
        if (kind === "manage" && row.view) next.add(row.view);
      }
      return Array.from(next);
    });
  }

  async function savePermissions() {
    if (!selected || !dirty) return;
    setSaving(true);
    try {
      const updated = await updateRole(selected.id, { permissions: draft });
      setData((current) => current ? { ...current, roles: current.roles.map((role) => role.id === updated.id ? updated : role) } : current);
      toast.success("Política atualizada", { description: `${updated.name} já está com as novas permissões.` });
    } catch (reason) {
      toast.error("Não foi possível salvar", { description: reason instanceof Error ? reason.message : "Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRole() {
    if (newName.trim().length < 2 || newDescription.trim().length < 2) return;
    setCreating(true);
    try {
      const role = await createRole({ name: newName.trim(), description: newDescription.trim(), permissions: [] });
      setData((current) => current ? { ...current, roles: [...current.roles, role] } : current);
      selectRole(role);
      setNewName("");
      setNewDescription("");
      setCreateOpen(false);
      toast.success("Cargo criado", { description: "Agora escolha o que este cargo pode acessar." });
    } catch (reason) {
      toast.error("Não foi possível criar o cargo", { description: reason instanceof Error ? reason.message : "Tente novamente." });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteRole() {
    if (!selected || selected.isSystem || assigned > 0) return;
    try {
      await deleteRole(selected.id);
      setData((current) => {
        if (!current) return current;
        const roles = current.roles.filter((role) => role.id !== selected.id);
        const next = roles[0] ?? null;
        setSelectedId(next?.id ?? null);
        setDraft(next?.permissions ?? []);
        return { ...current, roles };
      });
      toast.success("Cargo excluído");
    } catch (reason) {
      toast.error("Não foi possível excluir", { description: reason instanceof Error ? reason.message : "Tente novamente." });
    }
  }

  async function assignRole(memberId: number, roleId: number) {
    try {
      const updated = await updateUserRole(memberId, roleId);
      setData((current) => current ? { ...current, users: current.users.map((member) => member.id === updated.id ? updated : member) } : current);
      toast.success("Cargo atualizado", { description: `${updated.name} agora é ${updated.role.name}.` });
    } catch (reason) {
      toast.error("Não foi possível mudar o cargo", { description: reason instanceof Error ? reason.message : "Tente novamente." });
    }
  }

  if (loading) return <GovernanceSkeleton />;
  if (!data || !selected) return <div className="rounded-xl border bg-white p-8 text-sm text-muted-foreground">Nenhum cargo disponível.</div>;

  return (
    <div className="mx-auto max-w-[1480px] space-y-7">
      <section className="overflow-hidden rounded-2xl bg-[#171717] text-white shadow-panel">
        <div className="grid gap-8 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-9">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-2 text-sm text-white/55"><LockKeyhole className="h-4 w-4 text-primary" /> Controle de acesso</div>
            <h2 className="font-display text-4xl font-extrabold leading-none tracking-[-0.04em] sm:text-5xl">Cada pessoa vê o que precisa.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">Crie cargos, defina limites claros e mantenha as áreas sensíveis sob controle.</p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/10">
            {[
              { value: data.roles.length, label: "cargos" },
              { value: data.users.length, label: "pessoas" },
              { value: 4, label: "áreas" },
            ].map((item) => <div key={item.label} className="min-w-24 bg-white/[0.04] px-5 py-4 text-center"><div className="font-display text-2xl font-bold">{item.value}</div><div className="mt-1 text-[11px] text-white/45">{item.label}</div></div>)}
          </div>
        </div>
        <div className="h-1 bg-primary" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border bg-white shadow-panel">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div><h3 className="font-display text-lg font-bold">Cargos</h3><p className="mt-0.5 text-xs text-muted-foreground">Escolha para editar a política</p></div>
            <CreateRoleDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              name={newName}
              description={newDescription}
              creating={creating}
              onNameChange={setNewName}
              onDescriptionChange={setNewDescription}
              onCreate={() => void handleCreateRole()}
            />
          </div>
          <div className="p-2">
            {data.roles.map((role, index) => {
              const active = role.id === selected.id;
              const count = data.users.filter((member) => member.role.id === role.id).length;
              return (
                <button
                  type="button"
                  key={role.id}
                  onClick={() => selectRole(role)}
                  className={cn("group flex w-full items-center gap-3 rounded-lg p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-[#171717] text-white" : "hover:bg-muted")}
                >
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold", active ? "bg-primary text-white" : roleTones[index % roleTones.length])}>{initials(role.name)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{role.name}</span><span className={cn("mt-0.5 block text-[11px]", active ? "text-white/45" : "text-muted-foreground")}>{count} {count === 1 ? "pessoa" : "pessoas"} · {permissionCount(role)} acessos</span></span>
                  <ChevronRight className={cn("h-4 w-4", active ? "text-primary" : "text-neutral-300 group-hover:text-neutral-500")} />
                </button>
              );
            })}
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl border bg-white shadow-panel">
          <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-extrabold tracking-tight">{selected.name}</h3>
                {selected.isSystem && <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600"><LockKeyhole className="h-3 w-3" /> Cargo essencial</span>}
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{selected.description}</p>
            </div>
            <div className="flex gap-2">
              {!selected.isSystem && <Button variant="outline" size="sm" disabled={assigned > 0} onClick={() => void handleDeleteRole()} title={assigned > 0 ? "Mova as pessoas deste cargo antes de excluir" : "Excluir cargo"}><Trash2 className="h-4 w-4" />Excluir</Button>}
              <Button size="sm" disabled={!dirty || saving || selected.name === "Administrador"} onClick={() => void savePermissions()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar política</Button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {selected.name === "Administrador" && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                <p><strong>Seu acesso está protegido.</strong> O Administrador mantém todas as permissões para que a gestão do sistema nunca fique sem responsável.</p>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[minmax(0,1fr)_76px_76px] items-center bg-neutral-50 px-4 py-3 text-[11px] font-semibold text-muted-foreground sm:grid-cols-[minmax(0,1fr)_110px_110px]">
                <span>Área do sistema</span><span className="text-center">Pode ver</span><span className="text-center">Pode alterar</span>
              </div>
              {accessRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_76px_76px] items-center border-t px-4 py-4 sm:grid-cols-[minmax(0,1fr)_110px_110px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0"><span className="block text-sm font-bold">{row.label}</span><span className="block truncate text-[11px] text-muted-foreground">{row.description}</span></span>
                    </div>
                    {row.view ? <PermissionToggle checked={draft.includes(row.view)} disabled={selected.name === "Administrador"} label={`${row.label}: pode ver`} onChange={() => toggle(row.view!, row, "view")} /> : <span className="text-center text-neutral-300">—</span>}
                    <PermissionToggle checked={draft.includes(row.manage)} disabled={selected.name === "Administrador"} label={`${row.label}: pode alterar`} onChange={() => toggle(row.manage, row, "manage")} />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> Alterar uma área inclui automaticamente o acesso de leitura.</div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-white shadow-panel">
        <div className="flex items-center justify-between border-b px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><UsersRound className="h-5 w-5" /></span><div><h3 className="font-display text-xl font-bold">Equipe e cargos</h3><p className="mt-0.5 text-xs text-muted-foreground">As alterações passam a valer no próximo acesso da pessoa.</p></div></div>
        </div>
        <div className="divide-y">
          {data.users.map((member) => {
            const isYou = member.id === user?.id;
            return (
              <div key={member.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#171717] text-xs font-bold text-white">{initials(member.name)}</span>
                  <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{member.name}</p>{isYou && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Você</span>}</div><p className="truncate text-xs text-muted-foreground">{member.email}</p></div>
                </div>
                <div className="relative">
                  <CircleUserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    aria-label={`Cargo de ${member.name}`}
                    value={member.role.id}
                    disabled={isYou}
                    onChange={(event) => void assignRole(member.id, Number(event.target.value))}
                    className="h-10 w-full appearance-none rounded-md border bg-white pl-9 pr-8 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                  <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CreateRoleDialog({ open, onOpenChange, name, description, creating, onNameChange, onDescriptionChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; name: string; description: string; creating: boolean; onNameChange: (value: string) => void; onDescriptionChange: (value: string) => void; onCreate: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button size="icon" className="h-9 w-9" aria-label="Criar cargo"><Plus className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><KeyRound className="h-5 w-5" /></div>
          <DialogTitle>Criar novo cargo</DialogTitle>
          <DialogDescription>Dê um nome claro para o time. As permissões serão escolhidas logo depois.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-2"><Label htmlFor="role-name">Nome do cargo</Label><Input id="role-name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Ex.: Coordenador de operações" maxLength={50} autoFocus /></div>
          <div className="space-y-2"><Label htmlFor="role-description">Responsabilidade</Label><textarea id="role-description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Explique em uma frase o que este cargo faz." maxLength={160} rows={3} className="flex w-full resize-none rounded-md border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/25" /></div>
          <div className="flex justify-end gap-2 border-t pt-4"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={onCreate} disabled={creating || name.trim().length < 2 || description.trim().length < 2}>{creating && <Loader2 className="h-4 w-4 animate-spin" />}Criar cargo</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GovernanceSkeleton() {
  return <div className="mx-auto max-w-[1480px] space-y-5" aria-hidden><div className="h-60 animate-pulse rounded-2xl bg-[#171717]" /><div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]"><div className="h-[520px] animate-pulse rounded-xl border bg-white/70" /><div className="h-[520px] animate-pulse rounded-xl border bg-white/70" /></div></div>;
}
