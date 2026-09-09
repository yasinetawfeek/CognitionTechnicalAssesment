import type { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { notifyPermissionHolders, notifyUsers } from "@/kernel/notifications";
import { ForbiddenError, KernelError, NotFoundError } from "@/kernel/errors";
import type { KernelContext } from "@/kernel/context";

/**
 * Maker-checker ("four eyes") approvals.
 *
 * An app registers a handler for an approval *type* once at startup:
 *
 *   registerApprovalHandler("kyc.case.decision", {
 *     onApproved: async (req, ctx) => { ...apply the change... },
 *     onRejected: async (req, ctx) => { ...revert / notify... },
 *   });
 *
 * and opens requests from a server action:
 *
 *   await requestApproval(ctx, { appId: "kyc", type: "kyc.case.decision", title, payload,
 *                                requiredPermission: "kyc.case.approve" });
 *
 * The kernel enforces: decider holds `requiredPermission`, decider !== requester, single decision,
 * and audits + publishes `approval.requested` / `approval.decided` events.
 */

export interface ApprovalRequestRecord<T = unknown> {
  id: string;
  appId: string;
  type: string;
  title: string;
  description: string;
  payload: T;
  requiredPermission: string;
  status: string;
  requestedById: string;
  decidedById: string | null;
  decisionNote: string | null;
}

export interface ApprovalHandler<T = unknown> {
  onApproved?: (request: ApprovalRequestRecord<T>, ctx: KernelContext) => Promise<void> | void;
  onRejected?: (request: ApprovalRequestRecord<T>, ctx: KernelContext) => Promise<void> | void;
}

const g = globalThis as unknown as { __approvalHandlers?: Map<string, ApprovalHandler> };
const handlers = (g.__approvalHandlers ??= new Map());

export function registerApprovalHandler<T = unknown>(type: string, handler: ApprovalHandler<T>) {
  handlers.set(type, handler as ApprovalHandler);
}

export function listApprovalHandlers() {
  return [...handlers.keys()];
}

export interface RequestApprovalInput<T = unknown> {
  appId: string;
  type: string;
  title: string;
  description?: string;
  payload: T;
  requiredPermission: string;
}

export async function requestApproval<T>(ctx: KernelContext, input: RequestApprovalInput<T>) {
  const req = await db.approvalRequest.create({
    data: {
      appId: input.appId,
      type: input.type,
      title: input.title,
      description: input.description ?? "",
      payload: JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue,
      requiredPermission: input.requiredPermission,
      requestedById: ctx.user.id,
    },
  });
  await ctx.audit({
    appId: input.appId,
    action: "approval.request",
    targetType: "ApprovalRequest",
    targetId: req.id,
    after: { type: input.type, title: input.title, requiredPermission: input.requiredPermission },
  });
  await publish({
    type: "approval.requested",
    sourceAppId: input.appId,
    actorId: ctx.user.id,
    payload: { id: req.id, type: input.type, title: input.title, requiredPermission: input.requiredPermission },
  });
  await notifyPermissionHolders(
    input.requiredPermission,
    { title: `Approval needed: ${input.title}`, body: `Requested by ${ctx.user.name}`, href: `/approvals/${req.id}`, appId: input.appId },
    ctx.user.id,
  );
  return req;
}

export async function decideApproval(
  ctx: KernelContext,
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
) {
  const req = await db.approvalRequest.findUnique({ where: { id } });
  if (!req) throw new NotFoundError("Approval request");
  if (req.status !== "PENDING") throw new KernelError("Request already decided", 409, "ALREADY_DECIDED");
  if (!ctx.can(req.requiredPermission)) throw new ForbiddenError(req.requiredPermission);
  if (req.requestedById === ctx.user.id) {
    throw new ForbiddenError(undefined, "Four-eyes rule: you cannot approve your own request");
  }

  const updated = await db.approvalRequest.update({
    where: { id, status: "PENDING" },
    data: { status: decision, decidedById: ctx.user.id, decidedAt: new Date(), decisionNote: note ?? null },
  });

  const record: ApprovalRequestRecord = {
    id: updated.id,
    appId: updated.appId,
    type: updated.type,
    title: updated.title,
    description: updated.description,
    payload: updated.payload,
    requiredPermission: updated.requiredPermission,
    status: updated.status,
    requestedById: updated.requestedById,
    decidedById: updated.decidedById,
    decisionNote: updated.decisionNote,
  };

  const handler = handlers.get(req.type);
  try {
    if (decision === "APPROVED") await handler?.onApproved?.(record, ctx);
    else await handler?.onRejected?.(record, ctx);
  } catch (err) {
    console.error(`[approvals] handler for ${req.type} failed`, err);
    throw new KernelError(`Decision recorded but the ${req.type} handler failed: ${String(err)}`);
  }

  await ctx.audit({
    appId: req.appId,
    action: `approval.${decision.toLowerCase()}`,
    targetType: "ApprovalRequest",
    targetId: id,
    before: { status: "PENDING" },
    after: { status: decision, note: note ?? null },
  });
  await publish({
    type: "approval.decided",
    sourceAppId: req.appId,
    actorId: ctx.user.id,
    payload: { id, type: req.type, decision, note: note ?? null },
  });
  await notifyUsers([req.requestedById], {
    title: `${decision === "APPROVED" ? "Approved" : "Rejected"}: ${req.title}`,
    body: note ? `${ctx.user.name}: ${note}` : `Decided by ${ctx.user.name}`,
    href: `/approvals/${id}`,
    appId: req.appId,
  });
  return updated;
}

export async function cancelApproval(ctx: KernelContext, id: string) {
  const req = await db.approvalRequest.findUnique({ where: { id } });
  if (!req) throw new NotFoundError("Approval request");
  if (req.requestedById !== ctx.user.id) throw new ForbiddenError(undefined, "Only the requester can cancel");
  if (req.status !== "PENDING") throw new KernelError("Request already decided", 409, "ALREADY_DECIDED");
  const updated = await db.approvalRequest.update({ where: { id }, data: { status: "CANCELLED", decidedAt: new Date() } });
  await ctx.audit({ appId: req.appId, action: "approval.cancel", targetType: "ApprovalRequest", targetId: id });
  return updated;
}

export const approvals = { request: requestApproval, decide: decideApproval, cancel: cancelApproval, registerHandler: registerApprovalHandler };
