import { db } from "@/kernel/db";
import type { KernelContext } from "@/kernel/context";
import { publish } from "@/kernel/events/bus";
import { ForbiddenError, KernelError, NotFoundError } from "@/kernel/errors";
import { appAccessPermission } from "@/kernel/rbac/permissions";
import { isEnabled } from "@/kernel/flags";
import { getApp, listApps } from "./registry";
import type { AppManifest } from "./types";

/**
 * "My apps": business apps a user has added from the App Store. Kernel surfaces (category
 * "kernel") are always available and never installed. Installing never grants access — RBAC
 * (`<appId>.access`) still decides who can open an app; the store only lists what a user may install.
 */

export function isKernelSurface(app: Pick<AppManifest, "category">): boolean {
  return app.category === "kernel";
}

export function installableApps(): AppManifest[] {
  return listApps().filter((a) => !a.hidden && !isKernelSurface(a));
}

export async function installedAppIds(userId: string): Promise<string[]> {
  const rows = await db.appInstall.findMany({ where: { userId }, orderBy: { installedAt: "asc" }, select: { appId: true } });
  return rows.map((r) => r.appId);
}

export async function isInstalled(userId: string, appId: string): Promise<boolean> {
  return (await db.appInstall.findUnique({ where: { userId_appId: { userId, appId } } })) !== null;
}

export async function installApp(ctx: KernelContext, appId: string) {
  const app = getApp(appId);
  if (!app || app.hidden) throw new NotFoundError("App");
  if (isKernelSurface(app)) throw new KernelError("Platform surfaces are always available", 409);
  if (!ctx.can(appAccessPermission(appId))) throw new ForbiddenError(appAccessPermission(appId), `You need ${appAccessPermission(appId)} to install ${app.name}`);
  if (app.featureFlag && !(await isEnabled(app.featureFlag, ctx.user))) throw new KernelError(`${app.name} is not enabled for you yet`, 409);

  await db.appInstall.upsert({ where: { userId_appId: { userId: ctx.user.id, appId } }, create: { userId: ctx.user.id, appId }, update: {} });
  await ctx.audit({ appId: "kernel", action: "app.install", targetType: "App", targetId: appId });
  await publish({ type: "app.installed", sourceAppId: "kernel", actorId: ctx.user.id, payload: { appId, userId: ctx.user.id } });
  return app;
}

export async function uninstallApp(ctx: KernelContext, appId: string) {
  const app = getApp(appId);
  if (!app) throw new NotFoundError("App");
  await db.appInstall.deleteMany({ where: { userId: ctx.user.id, appId } });
  await ctx.audit({ appId: "kernel", action: "app.uninstall", targetType: "App", targetId: appId });
  await publish({ type: "app.uninstalled", sourceAppId: "kernel", actorId: ctx.user.id, payload: { appId, userId: ctx.user.id } });
  return app;
}
