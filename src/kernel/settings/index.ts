import type { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";
import type { KernelContext } from "@/kernel/context";

/** Typed key/value settings namespaced per app (thresholds, SLAs, integration URLs...). */
export async function getSetting<T>(appId: string, key: string, fallback: T): Promise<T> {
  const row = await db.appSetting.findUnique({ where: { appId_key: { appId, key } } });
  return row ? (row.value as T) : fallback;
}

export async function getAppSettings(appId: string): Promise<Record<string, unknown>> {
  const rows = await db.appSetting.findMany({ where: { appId } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting<T>(ctx: KernelContext, appId: string, key: string, value: T) {
  ctx.require("kernel.settings.manage");
  const before = await db.appSetting.findUnique({ where: { appId_key: { appId, key } } });
  const json = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  const row = await db.appSetting.upsert({
    where: { appId_key: { appId, key } },
    create: { appId, key, value: json },
    update: { value: json },
  });
  await ctx.audit({
    appId,
    action: "setting.update",
    targetType: "AppSetting",
    targetId: `${appId}.${key}`,
    before: before?.value ?? undefined,
    after: value,
  });
  return row;
}

export const settings = { get: getSetting, getAll: getAppSettings, set: setSetting };
