import type { Permission, User } from "@/lib/api";

export function can(user: User | null, permission: Permission) {
  return user?.role?.permissions?.includes(permission) ?? false;
}

export function firstAllowedRoute(user: User | null) {
  if (can(user, "metrics.view")) return "/comercial";
  if (can(user, "kanban.view")) return "/kanban";
  if (can(user, "integrations.view")) return "/integracoes";
  if (can(user, "governance.manage")) return "/governanca";
  return "/login";
}
