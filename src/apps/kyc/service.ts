import type { KycCase } from "@prisma/client";
import { db } from "@/kernel/db";
import { notifyUsers } from "@/kernel/notifications";
import { publish } from "@/kernel/events/bus";
import { recordAudit, type AuditActor } from "@/kernel/audit";
import type { KernelContext } from "@/kernel/context";
import { KernelError, NotFoundError } from "@/kernel/errors";
import { OPEN_STATUSES, type CaseStatus } from "./types";

/**
 * Domain helpers shared by server actions, the approval handler and the scoring job. Everything
 * here is server-only; pages should query `db.kycCase` directly and call actions for writes.
 */

export const APP_ID = "kyc";
export const APPROVAL_TYPE = "kyc.case.approve";
export const SCORE_JOB = "kyc.score-case";

export async function getCase(id: string): Promise<KycCase> {
  const kycCase = await db.kycCase.findUnique({ where: { id } });
  if (!kycCase) throw new NotFoundError("KYC case");
  return kycCase;
}

export function isOpen(status: string): boolean {
  return OPEN_STATUSES.includes(status as CaseStatus);
}

export function assertOpen(kycCase: KycCase) {
  if (!isOpen(kycCase.status)) throw new KernelError(`Case ${kycCase.reference} is already ${kycCase.status.toLowerCase()}`, 409, "CASE_CLOSED");
}

/** Approving a case with this profile needs a second pair of eyes (kyc.case.supervise). */
export function needsSupervisorSignOff(kycCase: Pick<KycCase, "riskLevel" | "sanctionsHit" | "pepMatch">): boolean {
  return kycCase.riskLevel === "HIGH" || kycCase.sanctionsHit || kycCase.pepMatch;
}

/** Sequential human-friendly references; retries on the (unlikely) race for the same number. */
export async function nextReference(): Promise<string> {
  const last = await db.kycCase.findFirst({ orderBy: { createdAt: "desc" }, select: { reference: true } });
  let n = last ? Number(last.reference.replace(/^KYC-/, "")) || 0 : 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    n += 1;
    const candidate = `KYC-${String(n).padStart(4, "0")}`;
    if (!(await db.kycCase.findUnique({ where: { reference: candidate }, select: { id: true } }))) return candidate;
  }
  throw new KernelError("Could not allocate a case reference", 500);
}

export interface DecisionInput {
  decision: "APPROVE" | "REJECT";
  note: string | null;
  /** Null when the system (auto-approve) decided. */
  actor: AuditActor;
  actorId: string | null;
  /** Free-text shown in the audit log, e.g. "auto-approved by scoring job". */
  via: "reviewer" | "supervisor" | "system";
}

/** Final state transition shared by direct decisions, supervisor sign-off and auto-approval. */
export async function applyDecision(kycCase: KycCase, input: DecisionInput) {
  assertOpen(kycCase);
  const status: CaseStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const updated = await db.kycCase.update({
    where: { id: kycCase.id },
    data: {
      status,
      decision: input.decision,
      decisionNote: input.note,
      decidedById: input.actorId,
      decidedAt: new Date(),
      approvalRequestId: null,
    },
  });
  await recordAudit(input.actor, {
    appId: APP_ID,
    action: input.decision === "APPROVE" ? "case.approve" : "case.reject",
    targetType: "KycCase",
    targetId: kycCase.id,
    before: { status: kycCase.status },
    after: { status, decision: input.decision, note: input.note },
    metadata: { reference: kycCase.reference, via: input.via, riskLevel: kycCase.riskLevel },
  });
  await publish({
    type: "kyc.case.decided",
    sourceAppId: APP_ID,
    actorId: input.actorId,
    payload: { caseId: kycCase.id, reference: kycCase.reference, decision: input.decision, riskLevel: kycCase.riskLevel, via: input.via },
  });
  const interested = [kycCase.assignedToId, kycCase.createdById].filter((id): id is string => !!id && id !== input.actorId);
  await notifyUsers(interested, {
    title: `${kycCase.reference} ${status === "APPROVED" ? "approved" : "rejected"}${input.via === "system" ? " automatically" : input.via === "supervisor" ? " by supervisor" : ""}`,
    body: input.note ?? "",
    href: `/kyc/${kycCase.id}`,
    appId: APP_ID,
  });
  return updated;
}

export function actorOf(ctx: KernelContext): AuditActor {
  return { id: ctx.user.id, email: ctx.user.email, ip: ctx.ip };
}

export async function addNote(actor: AuditActor, kycCase: KycCase, body: string) {
  const note = await db.kycCaseNote.create({ data: { caseId: kycCase.id, authorId: actor.id ?? "system", body } });
  await recordAudit(actor, {
    appId: APP_ID,
    action: "case.note",
    targetType: "KycCase",
    targetId: kycCase.id,
    after: { noteId: note.id, body },
    metadata: { reference: kycCase.reference },
  });
  return note;
}
