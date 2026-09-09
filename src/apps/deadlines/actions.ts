"use server";

import { z } from "zod";
import { action, formField, parseForm } from "@/kernel/actions";
import { requirePermission } from "@/kernel/context";
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { enqueueJob } from "@/kernel/jobs";
import { KernelError, NotFoundError } from "@/kernel/errors";
import { findVisibleDeadline } from "./data";
import { serializeList } from "./visibility";
import { CATEGORIES, VISIBILITIES } from "./types";

const createSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: formField.optionalString,
    category: z.enum(CATEGORIES),
    entity: formField.optionalString,
    dueAt: z.string().min(1, "Due date is required"),
    ownerId: z.string().min(1, "Owner is required"),
    visibility: z.enum(VISIBILITIES),
    visibleRoles: formField.list,
    visibleUsers: formField.list,
  })
  .refine((v) => v.visibility !== "ROLES" || v.visibleRoles.length > 0, { message: "Pick at least one role", path: ["visibleRoles"] })
  .refine((v) => v.visibility !== "USERS" || v.visibleUsers.length > 0, { message: "Pick at least one user", path: ["visibleUsers"] });

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.financeDeadline.count();
  return `FD-${year}-${String(count + 1).padStart(3, "0")}`;
}

export const createDeadlineAction = action(async (formData) => {
  const ctx = await requirePermission("deadlines.deadline.create");
  const input = parseForm(createSchema, formData);
  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) throw new KernelError("Invalid due date", 400);

  const deadline = await db.financeDeadline.create({
    data: {
      reference: await nextReference(),
      title: input.title,
      description: input.description ?? "",
      category: input.category,
      entity: input.entity ?? "",
      dueAt,
      ownerId: input.ownerId,
      createdById: ctx.user.id,
      visibility: input.visibility,
      visibleRoles: input.visibility === "ROLES" ? serializeList(input.visibleRoles) : "",
      visibleUsers: input.visibility === "USERS" ? serializeList(input.visibleUsers) : "",
    },
  });

  await ctx.audit({
    appId: "deadlines",
    action: "deadline.create",
    targetType: "FinanceDeadline",
    targetId: deadline.id,
    after: { reference: deadline.reference, title: deadline.title, dueAt, visibility: deadline.visibility },
  });
  await publish({
    type: "deadlines.deadline.created",
    sourceAppId: "deadlines",
    actorId: ctx.user.id,
    payload: { deadlineId: deadline.id, reference: deadline.reference, dueAt: dueAt.toISOString() },
  });
  return { ok: true, message: `Created ${deadline.reference}` };
});

export const completeDeadlineAction = action(async (formData) => {
  const ctx = await requirePermission("deadlines.deadline.complete");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  const deadline = await findVisibleDeadline(ctx, id);
  if (!deadline) throw new NotFoundError("Deadline");
  if (deadline.status === "COMPLETED") throw new KernelError("Deadline is already completed", 409);

  await db.financeDeadline.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date(), completedById: ctx.user.id },
  });
  await ctx.audit({
    appId: "deadlines",
    action: "deadline.complete",
    targetType: "FinanceDeadline",
    targetId: id,
    before: { status: deadline.status },
    after: { status: "COMPLETED" },
  });
  await publish({
    type: "deadlines.deadline.completed",
    sourceAppId: "deadlines",
    actorId: ctx.user.id,
    payload: { deadlineId: id, reference: deadline.reference },
  });
  return { ok: true, message: `${deadline.reference} marked as met` };
});

export const deleteDeadlineAction = action(async (formData) => {
  const ctx = await requirePermission("deadlines.deadline.manage");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  const deadline = await findVisibleDeadline(ctx, id);
  if (!deadline) throw new NotFoundError("Deadline");
  await db.financeDeadline.delete({ where: { id } });
  await ctx.audit({
    appId: "deadlines",
    action: "deadline.delete",
    targetType: "FinanceDeadline",
    targetId: id,
    before: { reference: deadline.reference, title: deadline.title, dueAt: deadline.dueAt },
  });
  await publish({
    type: "deadlines.deadline.deleted",
    sourceAppId: "deadlines",
    actorId: ctx.user.id,
    payload: { deadlineId: id, reference: deadline.reference },
  });
  return { ok: true, message: `${deadline.reference} deleted` };
});

/** Queue the reminder scan now instead of waiting for the next scheduled run. */
export const runReminderScanAction = action(async () => {
  const ctx = await requirePermission("deadlines.reminder.run");
  await enqueueJob("deadlines.scan-reminders", { trigger: "manual" });
  await ctx.audit({ appId: "deadlines", action: "reminder.scan", targetType: "FinanceDeadline" });
  return { ok: true, message: "Reminder scan queued" };
});
