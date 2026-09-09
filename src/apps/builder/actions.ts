"use server";

import { z } from "zod";
import { action, parseForm } from "@/kernel/actions";
import { requirePermission } from "@/kernel/context";
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { requestApproval } from "@/kernel/approvals";
import { enqueueJob } from "@/kernel/jobs";
import { getApp } from "@/kernel/apps/registry";
import { ForbiddenError, KernelError, NotFoundError, ValidationError } from "@/kernel/errors";
import type { PublishApprovalPayload } from "./types";

export const createAppRequestAction = action(async (formData) => {
  const ctx = await requirePermission("builder.request.create");
  const input = parseForm(
    z.object({
      appId: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, "Lowercase letters, digits and dashes, e.g. refunds"),
      name: z.string().min(2, "Name is required"),
      purpose: z.string().min(10, "Describe what the app is for (a sentence or two)"),
      requirements: z.string().min(20, "List the screens, data and permissions you need"),
    }),
    formData,
  );
  if (getApp(input.appId) || (await db.appRequest.findUnique({ where: { appId: input.appId } }))) {
    throw new ValidationError({ appId: ["An app with this id already exists"] });
  }
  const req = await db.appRequest.create({ data: { ...input, requestedById: ctx.user.id } });
  await ctx.audit({ appId: "builder", action: "request.create", targetType: "AppRequest", targetId: req.id, after: input });
  await publish({ type: "apprequest.created", sourceAppId: "builder", actorId: ctx.user.id, payload: { id: req.id, appId: req.appId, name: req.name } });
  await enqueueJob("builder.build-app", { requestId: req.id });
  return { ok: true, message: "Request queued — Devin is on it", data: { id: req.id } };
});

export const retryBuildAction = action(async (formData) => {
  const ctx = await requirePermission("builder.request.create");
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  const req = await db.appRequest.findUnique({ where: { id } });
  if (!req) throw new NotFoundError("App request");
  if (req.status !== "FAILED" && req.status !== "REJECTED") throw new KernelError("Only failed or rejected builds can be rebuilt", 409);
  await db.appRequest.update({ where: { id }, data: { status: "QUEUED" } });
  await ctx.audit({ appId: "builder", action: "request.rebuild", targetType: "AppRequest", targetId: id });
  await enqueueJob("builder.build-app", { requestId: id });
  return { ok: true, message: "Rebuild queued" };
});

export const submitForReviewAction = action(async (formData) => {
  const ctx = await requirePermission("builder.request.create");
  const { id, testNotes } = parseForm(z.object({ id: z.string(), testNotes: z.string().optional() }), formData);
  const req = await db.appRequest.findUnique({ where: { id } });
  if (!req) throw new NotFoundError("App request");
  if (req.requestedById !== ctx.user.id && !ctx.can("builder.request.review")) throw new ForbiddenError(undefined, "Only the requester can submit for review");
  if (req.status !== "READY_FOR_TESTING") throw new KernelError("Test the build first — it must be ready for testing", 409);

  await db.appRequest.update({ where: { id }, data: { status: "IN_REVIEW" } });
  await ctx.audit({ appId: "builder", action: "request.submit", targetType: "AppRequest", targetId: id, before: { status: req.status }, after: { status: "IN_REVIEW", testNotes } });
  await publish({ type: "apprequest.updated", sourceAppId: "builder", actorId: ctx.user.id, payload: { id, appId: req.appId, status: "IN_REVIEW" } });
  await requestApproval<PublishApprovalPayload>(ctx, {
    appId: "builder",
    type: "builder.app.publish",
    title: `Publish app "${req.name}" (/${req.appId})`,
    description: [req.purpose, testNotes ? `Requester's test notes: ${testNotes}` : null, req.prUrl ? `PR: ${req.prUrl}` : null].filter(Boolean).join("\n\n"),
    payload: { requestId: id, appId: req.appId, name: req.name, prUrl: req.prUrl, previewUrl: req.previewUrl },
    requiredPermission: "builder.request.review",
  });
  return { ok: true, message: "Sent for admin review" };
});
