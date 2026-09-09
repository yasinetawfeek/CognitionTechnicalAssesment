"use server";

import { z } from "zod";
import { action, formField, parseForm } from "@/kernel/actions";
import { requirePermission } from "@/kernel/context";
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { requestApproval } from "@/kernel/approvals";
import { enqueueJob } from "@/kernel/jobs";
import { KernelError, NotFoundError } from "@/kernel/errors";
import type { RecordApprovalPayload } from "./types";

export const createRecordAction = action(async (formData) => {
  const ctx = await requirePermission("playground.record.create");
  const input = parseForm(z.object({ title: z.string().min(1, "Title is required"), amount: formField.number.pipe(z.number().nonnegative()) }), formData);
  const record = await db.playgroundRecord.create({ data: { ...input, createdById: ctx.user.id } });
  await ctx.audit({ appId: "playground", action: "record.create", targetType: "PlaygroundRecord", targetId: record.id, after: input });
  await publish({ type: "playground.record.created", sourceAppId: "playground", actorId: ctx.user.id, payload: { recordId: record.id, ...input } });
  return { ok: true, message: `Created "${record.title}" — scoring job queued` };
});

export const submitRecordAction = action(async (formData) => {
  const ctx = await requirePermission("playground.record.submit");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  const record = await db.playgroundRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError("Record");
  if (record.status !== "DRAFT" && record.status !== "REJECTED") throw new KernelError("Only drafts can be submitted", 409);
  await db.playgroundRecord.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
  await ctx.audit({ appId: "playground", action: "record.submit", targetType: "PlaygroundRecord", targetId: id, before: { status: record.status }, after: { status: "PENDING_APPROVAL" } });
  await requestApproval<RecordApprovalPayload>(ctx, {
    appId: "playground",
    type: "playground.record.approve",
    title: `Approve "${record.title}" for ${record.amount.toFixed(2)}`,
    description: "Demo maker-checker flow. Approving flips the record to APPROVED.",
    payload: { recordId: id, title: record.title, amount: record.amount },
    requiredPermission: "playground.record.approve",
  });
  return { ok: true, message: "Sent for approval" };
});

export const rescoreRecordAction = action(async (formData) => {
  const ctx = await requirePermission("playground.record.create");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  await enqueueJob("playground.score-record", { recordId: id });
  await ctx.audit({ appId: "playground", action: "record.rescore", targetType: "PlaygroundRecord", targetId: id });
  return { ok: true, message: "Scoring job queued" };
});

export const deleteRecordAction = action(async (formData) => {
  const ctx = await requirePermission("playground.record.delete");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  const record = await db.playgroundRecord.delete({ where: { id } });
  await ctx.audit({ appId: "playground", action: "record.delete", targetType: "PlaygroundRecord", targetId: id, before: { title: record.title, amount: record.amount, status: record.status } });
  return { ok: true };
});
