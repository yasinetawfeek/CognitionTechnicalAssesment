/**
 * Server-side hooks for the KYC app. Imported once at boot from src/apps/server.ts.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";
import { publish, subscribe } from "@/kernel/events/bus";
import { registerApprovalHandler } from "@/kernel/approvals";
import { enqueueJob, registerJobHandler } from "@/kernel/jobs";
import { isEnabled } from "@/kernel/flags";
import { notifyUsers } from "@/kernel/notifications";
import { recordAudit } from "@/kernel/audit";
import { SYSTEM_ACTOR } from "@/kernel/context";
import { scoreCase } from "./scoring";
import { actorOf, addNote, applyDecision, APPROVAL_TYPE, SCORE_JOB, APP_ID } from "./service";
import { FLAGS, type CaseApprovalPayload, type RiskLevel } from "./types";

// 1. Four-eyes sign-off for high-risk approvals. The reviewer proposes APPROVE; a supervisor
//    (kyc.case.supervise) confirms it here, or sends the case back to the reviewer.
registerApprovalHandler<CaseApprovalPayload>(APPROVAL_TYPE, {
  onApproved: async (req, ctx) => {
    const kycCase = await db.kycCase.findUnique({ where: { id: req.payload.caseId } });
    if (!kycCase || kycCase.status !== "PENDING_APPROVAL") return;
    await applyDecision(kycCase, {
      decision: "APPROVE",
      note: req.decisionNote || req.payload.note,
      actor: actorOf(ctx),
      actorId: ctx.user.id,
      via: "supervisor",
    });
  },
  onRejected: async (req, ctx) => {
    const kycCase = await db.kycCase.findUnique({ where: { id: req.payload.caseId } });
    if (!kycCase || kycCase.status !== "PENDING_APPROVAL") return;
    await db.kycCase.update({ where: { id: kycCase.id }, data: { status: "IN_REVIEW", approvalRequestId: null } });
    await ctx.audit({
      appId: APP_ID,
      action: "case.approval_declined",
      targetType: "KycCase",
      targetId: kycCase.id,
      before: { status: "PENDING_APPROVAL" },
      after: { status: "IN_REVIEW", note: req.decisionNote },
      metadata: { reference: kycCase.reference },
    });
    await addNote(actorOf(ctx), kycCase, `Supervisor declined the approval${req.decisionNote ? `: ${req.decisionNote}` : "."} Case returned for further review.`);
    if (kycCase.assignedToId) {
      await notifyUsers([kycCase.assignedToId], {
        title: `${kycCase.reference} sent back by ${ctx.user.name}`,
        body: req.decisionNote ?? "The supervisor declined the approval.",
        href: `/kyc/${kycCase.id}`,
        appId: APP_ID,
      });
    }
  },
});

// 2. Risk scoring job. Stands in for the outlier-detection model: computes a score from the
//    applicant profile plus the deposit distribution of the rest of the queue, and optionally
//    auto-approves LOW-risk cases when the `kyc.auto-approve-low-risk` flag is on.
registerJobHandler<{ caseId: string }, { score: number; level: RiskLevel; autoApproved: boolean }>(SCORE_JOB, async ({ caseId }) => {
  const kycCase = await db.kycCase.findUniqueOrThrow({ where: { id: caseId } });
  const others = await db.kycCase.findMany({ where: { id: { not: caseId } }, select: { initialDeposit: true } });
  const result = scoreCase(kycCase, others.map((o) => o.initialDeposit));

  const before = { riskScore: kycCase.riskScore, riskLevel: kycCase.riskLevel };
  await db.kycCase.update({
    where: { id: caseId },
    data: { riskScore: result.score, riskLevel: result.level, riskFactors: result.factors as unknown as Prisma.InputJsonValue, scoredAt: new Date() },
  });
  await recordAudit(SYSTEM_ACTOR, {
    appId: APP_ID,
    action: "case.score",
    targetType: "KycCase",
    targetId: caseId,
    before,
    after: { riskScore: result.score, riskLevel: result.level, factors: result.factors.map((f) => f.factor) },
    metadata: { reference: kycCase.reference },
  });
  await publish({
    type: "kyc.case.scored",
    sourceAppId: APP_ID,
    actorId: null,
    payload: { caseId, reference: kycCase.reference, riskScore: result.score, riskLevel: result.level },
  });

  let autoApproved = false;
  const eligible = kycCase.status === "NEW" && result.level === "LOW" && !kycCase.pepMatch && !kycCase.sanctionsHit;
  if (eligible && (await isEnabled(FLAGS.autoApproveLowRisk))) {
    const fresh = await db.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    if (fresh.status === "NEW") {
      await applyDecision(fresh, {
        decision: "APPROVE",
        note: `Auto-approved: risk score ${result.score.toFixed(2)} (LOW) with no watch-list matches`,
        actor: SYSTEM_ACTOR,
        actorId: null,
        via: "system",
      });
      autoApproved = true;
    }
  }
  return { score: result.score, level: result.level, autoApproved };
});

// 3. Every new case is scored as soon as it lands in the queue.
subscribe<{ caseId: string }>("kyc.case.created", "kyc.auto-score", async (event) => {
  await enqueueJob(SCORE_JOB, { caseId: event.payload.caseId });
});
