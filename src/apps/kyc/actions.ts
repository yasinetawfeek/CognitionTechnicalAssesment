"use server";

import { z } from "zod";
import { action, formField, parseForm } from "@/kernel/actions";
import { requirePermission } from "@/kernel/context";
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { requestApproval } from "@/kernel/approvals";
import { enqueueJob } from "@/kernel/jobs";
import { notifyPermissionHolders } from "@/kernel/notifications";
import { ForbiddenError, KernelError } from "@/kernel/errors";
import { actorOf, addNote, applyDecision, APP_ID, APPROVAL_TYPE, assertOpen, getCase, needsSupervisorSignOff, nextReference, SCORE_JOB } from "./service";
import { DOCUMENT_TYPES, type CaseApprovalPayload } from "./types";

const idSchema = z.object({ id: z.string().min(1) });

export const createCaseAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.create");
  const input = parseForm(
    z.object({
      applicantName: z.string().trim().min(2, "Applicant name is required"),
      email: z.email("Enter a valid email"),
      country: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, "Use a 2-letter ISO country code"),
      dateOfBirth: z.coerce.date().max(new Date(), "Date of birth must be in the past"),
      documentType: z.enum(DOCUMENT_TYPES),
      documentNumber: z.string().trim().min(3, "Document number is required"),
      declaredIncome: formField.number.pipe(z.number().nonnegative()),
      initialDeposit: formField.number.pipe(z.number().nonnegative()),
      pepMatch: formField.checkbox,
      sanctionsHit: formField.checkbox,
    }),
    formData,
  );
  const reference = await nextReference();
  const kycCase = await db.kycCase.create({ data: { ...input, reference, createdById: ctx.user.id } });
  await ctx.audit({
    appId: APP_ID,
    action: "case.create",
    targetType: "KycCase",
    targetId: kycCase.id,
    after: { reference, applicantName: input.applicantName, country: input.country, initialDeposit: input.initialDeposit },
  });
  await publish({ type: "kyc.case.created", sourceAppId: APP_ID, actorId: ctx.user.id, payload: { caseId: kycCase.id, reference } });
  return { ok: true, message: `${reference} created — risk scoring queued`, data: { id: kycCase.id } };
});

export const rescoreCaseAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.create");
  const { id } = parseForm(idSchema, formData);
  const kycCase = await getCase(id);
  await enqueueJob(SCORE_JOB, { caseId: id });
  await ctx.audit({ appId: APP_ID, action: "case.rescore", targetType: "KycCase", targetId: id, metadata: { reference: kycCase.reference } });
  return { ok: true, message: "Scoring job queued" };
});

export const claimCaseAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.assign");
  const { id } = parseForm(idSchema, formData);
  const kycCase = await getCase(id);
  assertOpen(kycCase);
  if (kycCase.status === "PENDING_APPROVAL") throw new KernelError("Case is awaiting supervisor sign-off", 409);
  if (kycCase.status === "ESCALATED" && !ctx.can("kyc.case.supervise")) throw new ForbiddenError("kyc.case.supervise", "Escalated cases can only be claimed by a supervisor");
  if (kycCase.assignedToId && kycCase.assignedToId !== ctx.user.id) throw new KernelError("Case is already assigned to someone else", 409);
  const status = kycCase.status === "NEW" ? "IN_REVIEW" : kycCase.status;
  await db.kycCase.update({ where: { id }, data: { assignedToId: ctx.user.id, status } });
  await ctx.audit({
    appId: APP_ID,
    action: "case.claim",
    targetType: "KycCase",
    targetId: id,
    before: { status: kycCase.status, assignedToId: kycCase.assignedToId },
    after: { status, assignedToId: ctx.user.id },
    metadata: { reference: kycCase.reference },
  });
  await publish({ type: "kyc.case.assigned", sourceAppId: APP_ID, actorId: ctx.user.id, payload: { caseId: id, reference: kycCase.reference, assignedToId: ctx.user.id } });
  return { ok: true, message: `Claimed ${kycCase.reference}` };
});

export const releaseCaseAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.assign");
  const { id } = parseForm(idSchema, formData);
  const kycCase = await getCase(id);
  assertOpen(kycCase);
  if (kycCase.assignedToId !== ctx.user.id && !ctx.can("kyc.case.supervise")) throw new ForbiddenError("kyc.case.supervise", "Only the assignee or a supervisor can release a case");
  if (kycCase.status === "PENDING_APPROVAL") throw new KernelError("Case is awaiting supervisor sign-off", 409);
  const status = kycCase.status === "IN_REVIEW" ? "NEW" : kycCase.status;
  await db.kycCase.update({ where: { id }, data: { assignedToId: null, status } });
  await ctx.audit({
    appId: APP_ID,
    action: "case.release",
    targetType: "KycCase",
    targetId: id,
    before: { status: kycCase.status, assignedToId: kycCase.assignedToId },
    after: { status, assignedToId: null },
    metadata: { reference: kycCase.reference },
  });
  await publish({ type: "kyc.case.assigned", sourceAppId: APP_ID, actorId: ctx.user.id, payload: { caseId: id, reference: kycCase.reference, assignedToId: null } });
  return { ok: true, message: `Released ${kycCase.reference} back to the queue` };
});

export const addNoteAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.note");
  const { id, body } = parseForm(z.object({ id: z.string().min(1), body: z.string().trim().min(1, "Write something first").max(2000) }), formData);
  const kycCase = await getCase(id);
  await addNote(actorOf(ctx), kycCase, body);
  return { ok: true, message: "Note added" };
});

export const escalateCaseAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.decide");
  const { id, reason } = parseForm(z.object({ id: z.string().min(1), reason: z.string().trim().min(3, "Say why you are escalating").max(2000) }), formData);
  const kycCase = await getCase(id);
  assertOpen(kycCase);
  if (kycCase.status === "ESCALATED") throw new KernelError("Case is already escalated", 409);
  if (kycCase.status === "PENDING_APPROVAL") throw new KernelError("Case is awaiting supervisor sign-off", 409);
  await db.kycCase.update({ where: { id }, data: { status: "ESCALATED", assignedToId: null } });
  await ctx.audit({
    appId: APP_ID,
    action: "case.escalate",
    targetType: "KycCase",
    targetId: id,
    before: { status: kycCase.status, assignedToId: kycCase.assignedToId },
    after: { status: "ESCALATED", reason },
    metadata: { reference: kycCase.reference },
  });
  await addNote(actorOf(ctx), kycCase, `Escalated to supervisors: ${reason}`);
  await publish({ type: "kyc.case.escalated", sourceAppId: APP_ID, actorId: ctx.user.id, payload: { caseId: id, reference: kycCase.reference, reason } });
  await notifyPermissionHolders(
    "kyc.case.supervise",
    { title: `${kycCase.reference} escalated by ${ctx.user.name}`, body: reason, href: `/kyc/${id}`, appId: APP_ID },
    ctx.user.id,
  );
  return { ok: true, message: "Escalated — supervisors have been notified" };
});

export const decideCaseAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.decide");
  const { id, decision, note } = parseForm(
    z.object({ id: z.string().min(1), decision: z.enum(["APPROVE", "REJECT"]), note: formField.optionalString }),
    formData,
  );
  const kycCase = await getCase(id);
  assertOpen(kycCase);
  if (kycCase.status === "PENDING_APPROVAL") throw new KernelError("Case is awaiting supervisor sign-off", 409);
  if (kycCase.status === "ESCALATED" && !ctx.can("kyc.case.supervise")) throw new ForbiddenError("kyc.case.supervise", "Escalated cases are decided by a supervisor");
  if (kycCase.assignedToId && kycCase.assignedToId !== ctx.user.id && !ctx.can("kyc.case.supervise")) {
    throw new KernelError("Case is assigned to someone else — claim it first", 409);
  }
  if (kycCase.riskScore === null) throw new KernelError("Wait for risk scoring to finish before deciding", 409);
  if (decision === "REJECT" && !note) throw new KernelError("A rejection needs a note for the applicant file", 400);

  if (decision === "APPROVE" && needsSupervisorSignOff(kycCase)) {
    const payload: CaseApprovalPayload = {
      caseId: id,
      reference: kycCase.reference,
      applicantName: kycCase.applicantName,
      riskScore: kycCase.riskScore,
      riskLevel: kycCase.riskLevel,
      note: note ?? null,
    };
    const reasons = [kycCase.sanctionsHit && "sanctions hit", kycCase.pepMatch && "PEP match", kycCase.riskLevel === "HIGH" && "HIGH risk score"].filter(Boolean).join(", ");
    const req = await requestApproval<CaseApprovalPayload>(ctx, {
      appId: APP_ID,
      type: APPROVAL_TYPE,
      title: `Approve ${kycCase.reference} — ${kycCase.applicantName} (${reasons})`,
      description: note ? `${ctx.user.name}: ${note}` : `Proposed by ${ctx.user.name}. Approving onboards the applicant.`,
      payload,
      requiredPermission: "kyc.case.supervise",
    });
    await db.kycCase.update({ where: { id }, data: { status: "PENDING_APPROVAL", assignedToId: kycCase.assignedToId ?? ctx.user.id, approvalRequestId: req.id } });
    await ctx.audit({
      appId: APP_ID,
      action: "case.approve_requested",
      targetType: "KycCase",
      targetId: id,
      before: { status: kycCase.status },
      after: { status: "PENDING_APPROVAL", approvalRequestId: req.id, note: note ?? null },
      metadata: { reference: kycCase.reference, reasons },
    });
    await publish({ type: "kyc.case.decision_requested", sourceAppId: APP_ID, actorId: ctx.user.id, payload: { caseId: id, reference: kycCase.reference, approvalRequestId: req.id } });
    return { ok: true, message: `Sent to a supervisor for sign-off (${reasons})` };
  }

  await applyDecision(kycCase, { decision, note: note ?? null, actor: actorOf(ctx), actorId: ctx.user.id, via: ctx.can("kyc.case.supervise") ? "supervisor" : "reviewer" });
  return { ok: true, message: decision === "APPROVE" ? `${kycCase.reference} approved` : `${kycCase.reference} rejected` };
});
