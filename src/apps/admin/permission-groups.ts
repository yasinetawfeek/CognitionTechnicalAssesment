import { listPermissionGroups } from "@/kernel/apps/registry";
import type { PermissionGroup } from "./components/role-forms";

/** Permission groups for the role editor, with wildcard shortcuts prepended. */
export function editorPermissionGroups(): PermissionGroup[] {
  return listPermissionGroups().map((g) => ({
    app: g.appId,
    name: g.name,
    permissions: [
      g.appId === "kernel"
        ? { key: "*", description: "Everything — superuser" }
        : { key: `${g.appId}.*`, description: `All ${g.name} permissions` },
      ...g.permissions,
    ],
  }));
}
