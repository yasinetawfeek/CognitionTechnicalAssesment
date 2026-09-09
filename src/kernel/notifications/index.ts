import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { hasPermission } from "@/kernel/rbac/permissions";

export interface NotifyInput {
  title: string;
  body?: string;
  href?: string;
  appId?: string;
}

/** Send an in-app notification to specific users. */
export async function notifyUsers(userIds: string[], input: NotifyInput) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return 0;
  await db.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      title: input.title,
      body: input.body ?? "",
      href: input.href,
      appId: input.appId ?? "kernel",
    })),
  });
  await Promise.all(
    ids.map((userId) =>
      publish({
        type: "notification.created",
        sourceAppId: input.appId ?? "kernel",
        payload: { userId, title: input.title, href: input.href ?? null },
      }),
    ),
  );
  return ids.length;
}

/** Send to everyone holding a permission (e.g. all supervisors who can approve). */
export async function notifyPermissionHolders(permission: string, input: NotifyInput, excludeUserId?: string) {
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    include: { roles: { include: { role: { include: { permissions: true } } } } },
  });
  const targets = users
    .filter((u) => u.id !== excludeUserId)
    .filter((u) => hasPermission(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission)), permission))
    .map((u) => u.id);
  return notifyUsers(targets, input);
}

export async function listNotifications(userId: string, limit = 20) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, id?: string) {
  return db.notification.updateMany({
    where: { userId, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
}

export const notifications = { notifyUsers, notifyPermissionHolders, list: listNotifications, unreadCount, markRead };
