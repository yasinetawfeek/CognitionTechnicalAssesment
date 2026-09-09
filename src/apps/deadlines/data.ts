/**
 * Server-side data helpers shared by pages, actions and the reminder job.
 */
import { db } from "@/kernel/db";
import type { KernelContext } from "@/kernel/context";
import { canSeeDeadline, visibilityWhere, type DeadlineAudience, type Viewer } from "./visibility";

export function viewerOf(ctx: KernelContext): Viewer {
  return { id: ctx.user.id, roleKeys: ctx.user.roles.map((r) => r.key), permissions: ctx.user.permissions };
}

/** Every active user, with the role keys and permissions needed to evaluate visibility. */
export async function loadViewers(): Promise<(Viewer & { name: string; email: string })[]> {
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    include: { roles: { include: { role: { include: { permissions: true } } } } },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleKeys: u.roles.map((r) => r.role.key),
    permissions: u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission)),
  }));
}

/** Ids of the users a given deadline is visible to — the notification audience. */
export async function audienceFor(deadline: DeadlineAudience): Promise<{ id: string; name: string }[]> {
  const viewers = await loadViewers();
  return viewers.filter((v) => canSeeDeadline(v, deadline)).map((v) => ({ id: v.id, name: v.name }));
}

/** Fetch one deadline, returning null when the viewer is not part of its audience. */
export async function findVisibleDeadline(ctx: KernelContext, id: string) {
  const deadline = await db.financeDeadline.findUnique({ where: { id } });
  if (!deadline) return null;
  return canSeeDeadline(viewerOf(ctx), deadline) ? deadline : null;
}

/** Display names for owners and audiences, used by the tables and the create dialog. */
export async function loadNames() {
  const [users, roles] = await Promise.all([
    db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ select: { key: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    users,
    roles,
    names: {
      users: new Map(users.map((u) => [u.id, u.name])),
      roles: new Map(roles.map((r) => [r.key, r.name])),
    },
  };
}

export function visibleWhere(ctx: KernelContext) {
  return visibilityWhere(viewerOf(ctx));
}
