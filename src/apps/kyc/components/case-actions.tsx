"use client";

import { ActionForm, Alert, Button, Dialog, Field, FieldError, InlineAction, SubmitButton, Textarea } from "@/kernel/ui";
import { addNoteAction, claimCaseAction, decideCaseAction, escalateCaseAction, releaseCaseAction, rescoreCaseAction } from "../actions";

export interface CaseCapabilities {
  canAssign: boolean;
  canDecide: boolean;
  canSupervise: boolean;
  canNote: boolean;
  canRescore: boolean;
}

export function ClaimButton({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  return (
    <InlineAction action={claimCaseAction} values={{ id }} size={size} variant="secondary">
      Claim
    </InlineAction>
  );
}

/**
 * Right-hand action panel on the case page. Which controls appear depends on the case state and
 * the caller's permissions; the server actions re-check everything, this is only for UX.
 */
export function CasePanel({
  id,
  status,
  assignedToMe,
  assigned,
  scored,
  needsSignOff,
  caps,
}: {
  id: string;
  status: string;
  assignedToMe: boolean;
  assigned: boolean;
  scored: boolean;
  needsSignOff: boolean;
  caps: CaseCapabilities;
}) {
  const open = ["NEW", "IN_REVIEW", "ESCALATED"].includes(status);
  const mayDecide = caps.canDecide && open && (status !== "ESCALATED" || caps.canSupervise) && (assignedToMe || !assigned || caps.canSupervise);
  const mayClaim = caps.canAssign && open && !assigned && (status !== "ESCALATED" || caps.canSupervise);

  return (
    <div className="space-y-4">
      {status === "PENDING_APPROVAL" && (
        <Alert tone="warning" title="Awaiting supervisor sign-off">
          A supervisor with <span className="font-mono text-xs">kyc.case.supervise</span> must confirm this approval in the Approvals inbox.
        </Alert>
      )}
      {status === "ESCALATED" && !caps.canSupervise && (
        <Alert tone="info" title="Escalated">
          A supervisor will pick this case up.
        </Alert>
      )}

      {open && (
        <div className="flex flex-wrap gap-2">
          {mayClaim && <ClaimButton id={id} size="md" />}
          {caps.canAssign && assigned && (assignedToMe || caps.canSupervise) && (
            <InlineAction action={releaseCaseAction} values={{ id }} variant="secondary">
              Release
            </InlineAction>
          )}
          {caps.canRescore && (
            <InlineAction action={rescoreCaseAction} values={{ id }} variant="ghost">
              Re-score
            </InlineAction>
          )}
        </div>
      )}

      {mayDecide && (
        <ActionForm action={decideCaseAction}>
          <input type="hidden" name="id" value={id} />
          <Field label="Decision note" htmlFor="note" hint={needsSignOff ? "Approval will be routed to a supervisor (four-eyes)." : "Required for rejections."}>
            <Textarea id="note" name="note" rows={3} placeholder="Documents verified against the register; source of funds is salary." />
            <FieldError name="note" />
          </Field>
          {!scored && <p className="text-xs text-warning">Scoring hasn&apos;t finished yet — decisions are blocked until it has.</p>}
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="success" name="decision" value="APPROVE" pendingText="Applying…" disabled={!scored}>
              {needsSignOff ? "Propose approval" : "Approve"}
            </SubmitButton>
            <SubmitButton variant="danger" name="decision" value="REJECT" pendingText="Rejecting…" disabled={!scored}>
              Reject
            </SubmitButton>
          </div>
        </ActionForm>
      )}

      {mayDecide && status !== "ESCALATED" && <EscalateDialog id={id} />}

      {caps.canDecide && open && !mayDecide && (
        <Alert tone="info">{status === "ESCALATED" ? "Only a supervisor can decide an escalated case." : "This case is assigned to another reviewer."}</Alert>
      )}
    </div>
  );
}

function EscalateDialog({ id }: { id: string }) {
  return (
    <Dialog
      trigger={
        <Button variant="secondary" size="sm">
          Escalate to a supervisor
        </Button>
      }
      title="Escalate to a supervisor"
      description="Use this when you can't decide — e.g. conflicting documents or an unclear source of funds."
    >
      {(close) => (
        <ActionForm action={escalateCaseAction} onSuccess={close}>
          <input type="hidden" name="id" value={id} />
          <Field label="Reason" htmlFor="reason">
            <Textarea id="reason" name="reason" rows={3} required autoFocus />
            <FieldError name="reason" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Escalating…">Escalate</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function NoteForm({ id }: { id: string }) {
  return (
    <ActionForm action={addNoteAction} resetOnSuccess className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="body" rows={2} placeholder="Add a note to the case file…" required />
      <FieldError name="body" />
      <div className="flex justify-end">
        <SubmitButton size="sm" variant="secondary" pendingText="Adding…">
          Add note
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
