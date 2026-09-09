/**
 * Permission strings are dot-separated: `<app>.<resource>.<action>`.
 * Roles may hold wildcards: `*` (everything), `kyc.*` (whole app),
 * `kyc.case.*` (all actions on a resource).
 */
export type Permission = string;

export interface PermissionDefinition {
  key: Permission;
  description: string;
}

export const KERNEL_PERMISSIONS: PermissionDefinition[] = [
  { key: "kernel.users.read", description: "View users" },
  { key: "kernel.users.manage", description: "Create, edit, disable users and assign roles" },
  { key: "kernel.roles.manage", description: "Create roles and edit their permissions" },
  { key: "kernel.audit.read", description: "Read the audit log" },
  { key: "kernel.events.read", description: "Inspect the event stream" },
  { key: "kernel.webhooks.manage", description: "Manage outbound webhook subscriptions" },
  { key: "kernel.flags.read", description: "View feature flags" },
  { key: "kernel.flags.manage", description: "Create and toggle feature flags" },
  { key: "kernel.jobs.read", description: "View background jobs" },
  { key: "kernel.jobs.manage", description: "Retry / cancel background jobs" },
  { key: "kernel.approvals.read", description: "View the approvals inbox" },
  { key: "kernel.settings.manage", description: "Edit app settings" },
];

export function permissionMatches(granted: Permission, required: Permission): boolean {
  if (granted === "*" || granted === required) return true;
  if (granted.endsWith(".*")) {
    const prefix = granted.slice(0, -1); // keep trailing dot
    return required.startsWith(prefix);
  }
  return false;
}

export function hasPermission(granted: Iterable<Permission>, required: Permission): boolean {
  for (const g of granted) if (permissionMatches(g, required)) return true;
  return false;
}

export function appAccessPermission(appId: string): Permission {
  return `${appId}.access`;
}

const PERMISSION_RE = /^(\*|[a-z0-9_-]+(\.[a-z0-9_-]+)*(\.\*)?)$/;

export function isValidPermission(p: string): boolean {
  return PERMISSION_RE.test(p);
}
