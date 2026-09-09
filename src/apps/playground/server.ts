/**
 * Server-side hooks for the Playground app. Imported once at boot from src/apps/server.ts.
 */
import { db } from "@/kernel/db";
import { publish, subscribe } from "@/kernel/events/bus";
import { registerApprovalHandler } from "@/kernel/approvals";
import { enqueueJob, registerJobHandler } from "@/kernel/jobs";
import type { RecordApprovalPayload } from "./types";

// 1. Approval handler: the kernel calls this when a second person approves/rejects.
registerApprovalHandler<RecordApprovalPayload>("playground.record.approve", {
  onApproved: async (req, ctx) => {
    await db.playgroundRecord.update({ where: { id: req.payload.recordId }, data: { status: "APPROVED" } });
    await ctx.audit({ appId: "playground", action: "record.approve", targetType: "PlaygroundRecord", targetId: req.payload.recordId });
    await publish({ type: "playground.record.decided", sourceAppId: "playground", actorId: ctx.user.id, payload: { recordId: req.payload.recordId, decision: "APPROVED" } });
  },
  onRejected: async (req, ctx) => {
    await db.playgroundRecord.update({ where: { id: req.payload.recordId }, data: { status: "REJECTED" } });
    await ctx.audit({ appId: "playground", action: "record.reject", targetType: "PlaygroundRecord", targetId: req.payload.recordId });
    await publish({ type: "playground.record.decided", sourceAppId: "playground", actorId: ctx.user.id, payload: { recordId: req.payload.recordId, decision: "REJECTED" } });
  },
});

// 2. Background job: stands in for an ML model (e.g. KYC outlier detection). In a real app this
//    would POST to a Python scoring service; here it computes a toy z-score against other records.
registerJobHandler<{ recordId: string }, { riskScore: number; outlier: boolean }>("playground.score-record", async ({ recordId }) => {
  const record = await db.playgroundRecord.findUniqueOrThrow({ where: { id: recordId } });
  const others = await db.playgroundRecord.findMany({ where: { id: { not: recordId } }, select: { amount: true } });
  const amounts = others.map((o) => o.amount);
  const mean = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : record.amount;
  const variance = amounts.length ? amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length : 0;
  const sd = Math.sqrt(variance) || 1;
  const z = Math.abs((record.amount - mean) / sd);
  const riskScore = Math.round(Math.min(1, z / 3) * 100) / 100;
  await db.playgroundRecord.update({ where: { id: recordId }, data: { riskScore } });
  await publish({ type: "playground.record.scored", sourceAppId: "playground", actorId: null, payload: { recordId, riskScore } });
  return { riskScore, outlier: riskScore >= 0.66 };
});

// 3. Event subscriber: react to events from *other* apps / the kernel. Here: whenever a record is
//    created, queue it for scoring — the same pattern a KYC app would use to score new cases.
subscribe<{ recordId: string }>("playground.record.created", "playground.auto-score", async (event) => {
  await enqueueJob("playground.score-record", { recordId: event.payload.recordId });
});
