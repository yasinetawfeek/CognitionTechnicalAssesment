"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { action, formField, parseForm } from "@/kernel/actions";
import { requirePermission, requireUser } from "@/kernel/context";
import { db } from "@/kernel/db";
import { deleteFlag, toggleFlag, upsertFlag, type FlagRules } from "@/kernel/flags";
import { enqueueJob, retryJob } from "@/kernel/jobs";
import { deliverPendingWebhooks } from "@/kernel/events/webhooks";
import { publish } from "@/kernel/events/bus";
import { ValidationError } from "@/kernel/errors";

// --- Feature flags ---------------------------------------------------------

export const toggleFlagAction = action(async (formData) => {
  const ctx = await requireUser();
  const { key } = parseForm(z.object({ key: z.string() }), formData);
  const flag = await toggleFlag(ctx, key);
  return { ok: true, message: `${flag.key} is now ${flag.enabled ? "ON" : "OFF"}` };
});

const csv = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  z.array(z.string()),
);

export const saveFlagAction = action(async (formData) => {
  const ctx = await requireUser();
  const input = parseForm(
    z.object({
      key: z.string().min(1),
      description: formField.optionalString,
      enabled: formField.checkbox,
      ownerAppId: formField.optionalString,
      users: csv,
      roles: csv,
      percentage: formField.optionalString,
    }),
    formData,
  );
  const pct = input.percentage === undefined ? undefined : Number(input.percentage);
  if (pct !== undefined && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
    throw new ValidationError({ percentage: ["Must be between 0 and 100"] });
  }
  const rules: FlagRules = {};
  if (input.users.length) rules.users = input.users;
  if (input.roles.length) rules.roles = input.roles;
  if (pct !== undefined && pct < 100) rules.percentage = pct;
  await upsertFlag(ctx, {
    key: input.key,
    description: input.description ?? "",
    enabled: input.enabled,
    ownerAppId: input.ownerAppId,
    rules: Object.keys(rules).length ? rules : null,
  });
  return { ok: true, message: "Flag saved" };
});

export const deleteFlagAction = action(async (formData) => {
  const ctx = await requireUser();
  const { key } = parseForm(z.object({ key: z.string() }), formData);
  await deleteFlag(ctx, key);
  return { ok: true };
});

// --- Jobs ------------------------------------------------------------------

export const retryJobAction = action(async (formData) => {
  await requirePermission("kernel.jobs.manage");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  await retryJob(id);
  return { ok: true, message: "Job re-queued" };
});

export const enqueueJobAction = action(async (formData) => {
  const ctx = await requirePermission("kernel.jobs.manage");
  const { type, payload } = parseForm(z.object({ type: z.string().min(1), payload: formField.optionalString }), formData);
  let parsed: unknown = {};
  if (payload) {
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new ValidationError({ payload: ["Must be valid JSON"] });
    }
  }
  const job = await enqueueJob(type, parsed);
  await ctx.audit({ appId: "kernel", action: "job.enqueue", targetType: "Job", targetId: job.id, after: { type } });
  return { ok: true, message: `Queued ${job.type}` };
});

// --- Webhooks --------------------------------------------------------------

export const createWebhookAction = action(async (formData) => {
  const ctx = await requirePermission("kernel.webhooks.manage");
  const input = parseForm(z.object({ name: z.string().min(1), url: z.string().url(), eventTypes: z.string().min(1) }), formData);
  const secret = randomBytes(24).toString("hex");
  const sub = await db.webhookSubscription.create({
    data: { name: input.name, url: input.url, eventTypes: input.eventTypes.replace(/\s+/g, ""), secret },
  });
  await ctx.audit({ appId: "kernel", action: "webhook.create", targetType: "WebhookSubscription", targetId: sub.id, after: { name: sub.name, url: sub.url, eventTypes: sub.eventTypes } });
  return { ok: true, data: { secret } };
});

export const toggleWebhookAction = action(async (formData) => {
  const ctx = await requirePermission("kernel.webhooks.manage");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  const sub = await db.webhookSubscription.findUniqueOrThrow({ where: { id } });
  await db.webhookSubscription.update({ where: { id }, data: { active: !sub.active } });
  await ctx.audit({ appId: "kernel", action: "webhook.update", targetType: "WebhookSubscription", targetId: id, before: { active: sub.active }, after: { active: !sub.active } });
  return { ok: true };
});

export const deleteWebhookAction = action(async (formData) => {
  const ctx = await requirePermission("kernel.webhooks.manage");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  const sub = await db.webhookSubscription.delete({ where: { id } });
  await ctx.audit({ appId: "kernel", action: "webhook.delete", targetType: "WebhookSubscription", targetId: id, before: { name: sub.name, url: sub.url } });
  return { ok: true };
});

export const flushWebhooksAction = action(async () => {
  await requirePermission("kernel.webhooks.manage");
  const n = await deliverPendingWebhooks(50);
  return { ok: true, message: `Attempted ${n} deliver${n === 1 ? "y" : "ies"}` };
});

// --- Events ----------------------------------------------------------------

export const publishTestEventAction = action(async (formData) => {
  const ctx = await requirePermission("kernel.events.read");
  const { type, payload } = parseForm(z.object({ type: z.string().regex(/^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/, "Use dotted lowercase, e.g. demo.ping"), payload: formField.optionalString }), formData);
  let parsed: unknown = {};
  if (payload) {
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new ValidationError({ payload: ["Must be valid JSON"] });
    }
  }
  await publish({ type, sourceAppId: "system", actorId: ctx.user.id, payload: parsed });
  return { ok: true, message: `Published ${type}` };
});
