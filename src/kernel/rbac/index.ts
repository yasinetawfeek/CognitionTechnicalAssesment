import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import type { KernelContext } from "@/kernel/context";
import { hashPassword } from "@/kernel/auth/password";
import { destroyAllSessions } from "@/kernel/auth/session";
import { KernelError, NotFoundError, ValidationError } from "@/kernel/errors";
import { isValidPermission } from "./permissions";

export * from "./permissions";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers() {
  return db.user.findMany({
    orderBy: { name: "asc" },
    include: { roles: { include: { role: true } } },
  });
}

export async function getUser(id: string) {
  const user = await db.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function createUser(
  ctx: KernelContext,
  input: { email: string; name: string; password?: string; roleIds: string[] },
) {
  ctx.require("kernel.users.manage");
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError({ email: ["Invalid email"] });
  if (!input.name.trim()) throw new ValidationError({ name: ["Name is required"] });
  if (await db.user.findUnique({ where: { email } })) throw new ValidationError({ email: ["Email already in use"] });

  const user = await db.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: input.password ? await hashPassword(input.password) : null,
      roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
    },
    include: { roles: { include: { role: true } } },
  });
  await ctx.audit({
    appId: "kernel",
    action: "user.create",
    targetType: "User",
    targetId: user.id,
    after: { email, name: user.name, roles: user.roles.map((r) => r.role.key) },
  });
  await publish({ type: "kernel.user.created", sourceAppId: "kernel", actorId: ctx.user.id, payload: { id: user.id, email } });
  return user;
}

export async function updateUser(
  ctx: KernelContext,
  id: string,
  input: { name?: string; status?: "ACTIVE" | "DISABLED"; roleIds?: string[]; password?: string },
) {
  ctx.require("kernel.users.manage");
  const before = await getUser(id);
  if (id === ctx.user.id && input.status === "DISABLED") throw new KernelError("You cannot disable yourself", 400);

  const user = await db.user.update({
    where: { id },
    data: {
      name: input.name?.trim() || undefined,
      status: input.status,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
      roles: input.roleIds ? { deleteMany: {}, create: input.roleIds.map((roleId) => ({ roleId })) } : undefined,
    },
    include: { roles: { include: { role: true } } },
  });
  if (input.status === "DISABLED" || input.roleIds) await destroyAllSessions(id).catch(() => {});

  await ctx.audit({
    appId: "kernel",
    action: "user.update",
    targetType: "User",
    targetId: id,
    before: { name: before.name, status: before.status, roles: before.roles.map((r) => r.role.key) },
    after: { name: user.name, status: user.status, roles: user.roles.map((r) => r.role.key), passwordReset: !!input.password },
  });
  await publish({ type: "kernel.user.updated", sourceAppId: "kernel", actorId: ctx.user.id, payload: { id, status: user.status } });
  return user;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function listRoles() {
  return db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { permissions: true, _count: { select: { users: true } } },
  });
}

export async function getRole(id: string) {
  const role = await db.role.findUnique({ where: { id }, include: { permissions: true, users: { include: { user: true } } } });
  if (!role) throw new NotFoundError("Role");
  return role;
}

export async function createRole(ctx: KernelContext, input: { key: string; name: string; description?: string; permissions: string[] }) {
  ctx.require("kernel.roles.manage");
  const key = input.key.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new ValidationError({ key: ["Use lowercase letters, digits, underscores"] });
  if (await db.role.findUnique({ where: { key } })) throw new ValidationError({ key: ["Role key already exists"] });
  const permissions = normalisePermissions(input.permissions);
  const role = await db.role.create({
    data: {
      key,
      name: input.name.trim() || key,
      description: input.description ?? "",
      permissions: { create: permissions.map((permission) => ({ permission })) },
    },
  });
  await ctx.audit({ appId: "kernel", action: "role.create", targetType: "Role", targetId: role.id, after: { key, permissions } });
  await publish({ type: "kernel.role.updated", sourceAppId: "kernel", actorId: ctx.user.id, payload: { id: role.id, key } });
  return role;
}

export async function updateRole(ctx: KernelContext, id: string, input: { name?: string; description?: string; permissions?: string[] }) {
  ctx.require("kernel.roles.manage");
  const before = await getRole(id);
  if (before.isSystem && input.permissions) throw new KernelError("System role permissions are fixed", 400);
  const permissions = input.permissions ? normalisePermissions(input.permissions) : undefined;
  const role = await db.role.update({
    where: { id },
    data: {
      name: input.name?.trim() || undefined,
      description: input.description,
      permissions: permissions ? { deleteMany: {}, create: permissions.map((permission) => ({ permission })) } : undefined,
    },
    include: { permissions: true },
  });
  // Permission changes take effect on next request (permissions are loaded per request).
  await ctx.audit({
    appId: "kernel",
    action: "role.update",
    targetType: "Role",
    targetId: id,
    before: { name: before.name, permissions: before.permissions.map((p) => p.permission) },
    after: { name: role.name, permissions: role.permissions.map((p) => p.permission) },
  });
  await publish({ type: "kernel.role.updated", sourceAppId: "kernel", actorId: ctx.user.id, payload: { id, key: role.key } });
  return role;
}

export async function deleteRole(ctx: KernelContext, id: string) {
  ctx.require("kernel.roles.manage");
  const role = await getRole(id);
  if (role.isSystem) throw new KernelError("System roles cannot be deleted", 400);
  await db.role.delete({ where: { id } });
  await ctx.audit({ appId: "kernel", action: "role.delete", targetType: "Role", targetId: id, before: { key: role.key } });
  await publish({ type: "kernel.role.updated", sourceAppId: "kernel", actorId: ctx.user.id, payload: { id, key: role.key, deleted: true } });
}

function normalisePermissions(perms: string[]): string[] {
  const clean = [...new Set(perms.map((p) => p.trim()).filter(Boolean))];
  const bad = clean.filter((p) => !isValidPermission(p));
  if (bad.length) throw new ValidationError({ permissions: bad.map((b) => `Invalid permission "${b}"`) });
  return clean.sort();
}

export const rbac = { listUsers, getUser, createUser, updateUser, listRoles, getRole, createRole, updateRole, deleteRole };
