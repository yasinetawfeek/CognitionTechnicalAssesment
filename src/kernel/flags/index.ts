import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";
import { publish, subscribe } from "@/kernel/events/bus";
import type { SessionUser } from "@/kernel/auth/session";
import type { KernelContext } from "@/kernel/context";
import { NotFoundError, ValidationError } from "@/kernel/errors";

/**
 * Feature flags SDK.
 *
 * Server:  `await isEnabled("kyc.ml-outlier-score", ctx.user)`
 * Client:  `const on = useFlag("kyc.ml-outlier-score")` (live; re-evaluates on `flag.updated`)
 *
 * Evaluation order: flag missing → false; `enabled` false → false; no rules → true;
 * rules: users (email allow-list) → roles → percentage rollout (stable hash of key+user id).
 * A small in-process cache is invalidated by the event bus so toggles from the admin panel apply
 * to every app immediately.
 */

export interface FlagRules {
  users?: string[];
  roles?: string[];
  percentage?: number;
}

export interface FlagRecord {
  key: string;
  description: string;
  enabled: boolean;
  rules: FlagRules | null;
  ownerAppId: string;
}

const g = globalThis as unknown as { __flagCache?: { at: number; flags: Map<string, FlagRecord> } | null };
const CACHE_TTL_MS = 30_000;

async function loadFlags(): Promise<Map<string, FlagRecord>> {
  const cached = g.__flagCache;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.flags;
  const rows = await db.featureFlag.findMany();
  const flags = new Map<string, FlagRecord>();
  for (const r of rows) {
    flags.set(r.key, {
      key: r.key,
      description: r.description,
      enabled: r.enabled,
      rules: (r.rules as FlagRules | null) ?? null,
      ownerAppId: r.ownerAppId,
    });
  }
  g.__flagCache = { at: Date.now(), flags };
  return flags;
}

export function invalidateFlagCache() {
  g.__flagCache = null;
}

subscribe("flag.*", "kernel.flags.cache-invalidate", () => invalidateFlagCache());

type Subject = Pick<SessionUser, "id" | "email" | "roles"> | null | undefined;

export function evaluateFlag(flag: FlagRecord | undefined, subject: Subject): boolean {
  if (!flag || !flag.enabled) return false;
  const rules = flag.rules;
  if (!rules || (!rules.users?.length && !rules.roles?.length && rules.percentage === undefined)) return true;
  if (!subject) return false;
  if (rules.users?.some((e) => e.toLowerCase() === subject.email.toLowerCase())) return true;
  if (rules.roles?.some((r) => subject.roles.some((sr) => sr.key === r))) return true;
  if (rules.percentage !== undefined) {
    const bucket = parseInt(createHash("sha256").update(`${flag.key}:${subject.id}`).digest("hex").slice(0, 8), 16) % 100;
    return bucket < rules.percentage;
  }
  return false;
}

export async function isEnabled(key: string, subject?: Subject): Promise<boolean> {
  const flags = await loadFlags();
  return evaluateFlag(flags.get(key), subject);
}

/** Evaluate every flag for a subject — used by the client bootstrap endpoint. */
export async function evaluateAll(subject: Subject): Promise<Record<string, boolean>> {
  const flags = await loadFlags();
  const out: Record<string, boolean> = {};
  for (const f of flags.values()) out[f.key] = evaluateFlag(f, subject);
  return out;
}

export async function listFlags() {
  return db.featureFlag.findMany({ orderBy: { key: "asc" } });
}

const KEY_RE = /^[a-z0-9][a-z0-9._-]*$/;

export async function upsertFlag(
  ctx: KernelContext,
  input: { key: string; description?: string; enabled?: boolean; rules?: FlagRules | null; ownerAppId?: string },
) {
  ctx.require("kernel.flags.manage");
  if (!KEY_RE.test(input.key)) throw new ValidationError({ key: ["Use lowercase letters, digits, dots, dashes"] });
  const before = await db.featureFlag.findUnique({ where: { key: input.key } });
  const rules = input.rules === undefined ? undefined : (input.rules as Prisma.InputJsonValue | null);
  const flag = await db.featureFlag.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      description: input.description ?? "",
      enabled: input.enabled ?? false,
      rules: rules ?? undefined,
      ownerAppId: input.ownerAppId ?? "kernel",
      updatedById: ctx.user.id,
    },
    update: {
      description: input.description,
      enabled: input.enabled,
      rules: rules === null ? Prisma.JsonNull : rules,
      ownerAppId: input.ownerAppId,
      updatedById: ctx.user.id,
    },
  });
  invalidateFlagCache();
  await ctx.audit({
    appId: "kernel",
    action: before ? "flag.update" : "flag.create",
    targetType: "FeatureFlag",
    targetId: flag.key,
    before: before ? { enabled: before.enabled, rules: before.rules, description: before.description } : undefined,
    after: { enabled: flag.enabled, rules: flag.rules, description: flag.description },
  });
  await publish({
    type: "flag.updated",
    sourceAppId: "kernel",
    actorId: ctx.user.id,
    payload: { key: flag.key, enabled: flag.enabled, rules: flag.rules },
  });
  return flag;
}

export async function toggleFlag(ctx: KernelContext, key: string) {
  const flag = await db.featureFlag.findUnique({ where: { key } });
  if (!flag) throw new NotFoundError("Feature flag");
  return upsertFlag(ctx, { key, enabled: !flag.enabled });
}

export async function deleteFlag(ctx: KernelContext, key: string) {
  ctx.require("kernel.flags.manage");
  const flag = await db.featureFlag.findUnique({ where: { key } });
  if (!flag) throw new NotFoundError("Feature flag");
  await db.featureFlag.delete({ where: { key } });
  invalidateFlagCache();
  await ctx.audit({ appId: "kernel", action: "flag.delete", targetType: "FeatureFlag", targetId: key, before: { enabled: flag.enabled } });
  await publish({ type: "flag.deleted", sourceAppId: "kernel", actorId: ctx.user.id, payload: { key } });
}

export const flags = { isEnabled, evaluateAll, list: listFlags, upsert: upsertFlag, toggle: toggleFlag, remove: deleteFlag };
