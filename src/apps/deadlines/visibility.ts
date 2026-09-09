/**
 * Visibility rules for financial deadlines.
 *
 * A deadline is either public to everyone with app access, scoped to a set of roles, or scoped to
 * named users. The owner always sees their own deadline, and holders of `deadlines.deadline.viewall`
 * (e.g. the CFO / admins) see everything.
 *
 * Role and user lists are stored pipe-delimited ("|admin|treasury|") so a single SQLite `contains`
 * predicate can filter them without a join table.
 */
import { hasPermission } from "@/kernel/rbac/permissions";
import type { DeadlineVisibility } from "./types";

export const VIEW_ALL_PERMISSION = "deadlines.deadline.viewall";
export const ACCESS_PERMISSION = "deadlines.access";

export function serializeList(values: string[]): string {
  const clean = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  return clean.length ? `|${clean.join("|")}|` : "";
}

export function parseList(value: string): string[] {
  return value.split("|").filter(Boolean);
}

export interface DeadlineAudience {
  ownerId: string;
  visibility: string;
  visibleRoles: string;
  visibleUsers: string;
}

export interface Viewer {
  id: string;
  roleKeys: string[];
  permissions: string[];
}

export function canSeeDeadline(viewer: Viewer, deadline: DeadlineAudience): boolean {
  if (!hasPermission(viewer.permissions, ACCESS_PERMISSION)) return false;
  if (hasPermission(viewer.permissions, VIEW_ALL_PERMISSION)) return true;
  if (deadline.ownerId === viewer.id) return true;
  switch (deadline.visibility as DeadlineVisibility) {
    case "EVERYONE":
      return true;
    case "ROLES":
      return parseList(deadline.visibleRoles).some((key) => viewer.roleKeys.includes(key));
    case "USERS":
      return parseList(deadline.visibleUsers).includes(viewer.id);
    default:
      return false;
  }
}

/**
 * Prisma `where` fragment restricting a query to the deadlines a viewer may see. Mirrors
 * `canSeeDeadline` — keep the two in sync.
 */
export function visibilityWhere(viewer: Viewer) {
  if (hasPermission(viewer.permissions, VIEW_ALL_PERMISSION)) return {};
  return {
    OR: [
      { visibility: "EVERYONE" },
      { ownerId: viewer.id },
      { visibility: "USERS", visibleUsers: { contains: `|${viewer.id}|` } },
      ...viewer.roleKeys.map((key) => ({ visibility: "ROLES", visibleRoles: { contains: `|${key}|` } })),
    ],
  };
}

export function describeAudience(deadline: DeadlineAudience, names: { roles: Map<string, string>; users: Map<string, string> }): string {
  switch (deadline.visibility as DeadlineVisibility) {
    case "EVERYONE":
      return "Everyone with app access";
    case "ROLES": {
      const keys = parseList(deadline.visibleRoles);
      return keys.length ? keys.map((k) => names.roles.get(k) ?? k).join(", ") : "No roles selected";
    }
    case "USERS": {
      const ids = parseList(deadline.visibleUsers);
      return ids.length ? ids.map((id) => names.users.get(id) ?? id).join(", ") : "No users selected";
    }
    default:
      return "Unknown";
  }
}
