"use client";

import { ActionForm, Field, InlineAction, SubmitButton, Textarea } from "@/kernel/ui";
import { cancelApprovalAction, decideApprovalAction } from "../actions";

export function DecisionForm({ id, cancelOnly }: { id: string; cancelOnly?: boolean }) {
  if (cancelOnly) {
    return (
      <InlineAction action={cancelApprovalAction} values={{ id }} variant="secondary" size="sm" confirm="Cancel this request?">
        Cancel request
      </InlineAction>
    );
  }
  return (
    <ActionForm action={decideApprovalAction}>
      <input type="hidden" name="id" value={id} />
      <Field label="Note (optional)" htmlFor="note" hint="Shown to the requester and stored in the audit log.">
        <Textarea id="note" name="note" rows={2} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton variant="success" name="decision" value="APPROVED" pendingText="Applying…">
          Approve
        </SubmitButton>
        <SubmitButton variant="danger" name="decision" value="REJECTED" pendingText="Rejecting…">
          Reject
        </SubmitButton>
      </div>
      <p className="text-xs text-muted">Approving runs the owning app&apos;s handler immediately (e.g. applies the KYC decision).</p>
    </ActionForm>
  );
}
