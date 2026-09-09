import type { PermissionDefinition } from "@/kernel/rbac/permissions";

export type AppCategory = "kernel" | "operations" | "engineering" | "finance" | "other";

export interface AppNavItem {
  label: string;
  /** Path relative to the app root, e.g. "" or "/settings". */
  path: string;
  /** Permission required to see this nav item (defaults to app access). */
  permission?: string;
}

export interface AppEventDefinition {
  type: string;
  description: string;
}

export interface AppManifest {
  /** Unique id, lowercase, used as route prefix (`/<id>`) and permission namespace. */
  id: string;
  name: string;
  description: string;
  /** lucide icon name, see src/kernel/ui/icon.tsx */
  icon: string;
  category: AppCategory;
  /** Permissions this app declares. `<id>.access` is added automatically. */
  permissions: PermissionDefinition[];
  /** Events this app publishes (documentation + explorer filters). */
  events?: AppEventDefinition[];
  /** Secondary navigation shown when the app is active. */
  nav?: AppNavItem[];
  /** Hide from the launcher/sidebar (e.g. internal tools). */
  hidden?: boolean;
  /** Feature flag key that must be enabled for the app to appear. */
  featureFlag?: string;
}

export function defineApp(manifest: AppManifest): AppManifest {
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
    throw new Error(`Invalid app id "${manifest.id}" — use lowercase letters, digits, dashes`);
  }
  return manifest;
}
