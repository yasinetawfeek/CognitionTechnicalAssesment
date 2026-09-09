"use server";

import { z } from "zod";
import { action, formField, parseForm } from "@/kernel/actions";
import { requireUser } from "@/kernel/context";
import { cancelApproval, decideApproval } from "@/kernel/approvals";

export const decideApprovalAction = action(async (formData) => {
  const ctx = await requireUser();
  const { id, decision, note } = parseForm(
    z.object({ id: z.string(), decision: z.enum(["APPROVED", "REJECTED"]), note: formField.optionalString }),
    formData,
  );
  await decideApproval(ctx, id, decision, note);
  return { ok: true, message: decision === "APPROVED" ? "Approved" : "Rejected" };
});

export const cancelApprovalAction = action(async (formData) => {
  const ctx = await requireUser();
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  await cancelApproval(ctx, id);
  return { ok: true, message: "Cancelled" };
});
