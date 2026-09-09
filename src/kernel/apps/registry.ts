import { apps } from "@/apps";
import type { AppManifest } from "./types";
import { appAccessPermission, KERNEL_PERMISSIONS, type PermissionDefinition } from "@/kernel/rbac/permissions";

export function listApps(): AppManifest[] {
  return apps;
}

export function getApp(id: string): AppManifest | undefined {
  return apps.find((a) => a.id === id);
}

export function appPermissions(app: AppManifest): PermissionDefinition[] {
  return [
    { key: appAccessPermission(app.id), description: `Open the ${app.name} app` },
    ...app.permissions,
  ];
}

/** Every permission known to the system, grouped by app (kernel first). */
export function listPermissionGroups(): { appId: string; name: string; permissions: PermissionDefinition[] }[] {
  return [
    { appId: "kernel", name: "Kernel", permissions: KERNEL_PERMISSIONS },
    ...apps.map((a) => ({ appId: a.id, name: a.name, permissions: appPermissions(a) })),
  ];
}

export function listAllPermissionKeys(): string[] {
  return listPermissionGroups().flatMap((g) => g.permissions.map((p) => p.key));
}

export function listAllEventTypes(): { type: string; description: string; appId: string }[] {
  return apps.flatMap((a) => (a.events ?? []).map((e) => ({ ...e, appId: a.id })));
}
