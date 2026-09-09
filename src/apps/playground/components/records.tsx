"use client";

import { ActionForm, Badge, Button, Dialog, Field, FieldError, InlineAction, Input, SubmitButton } from "@/kernel/ui";
import { useFlag } from "@/kernel/flags/client";
import { createRecordAction, deleteRecordAction, rescoreRecordAction, submitRecordAction } from "../actions";

export function CreateRecordDialog() {
  return (
    <Dialog trigger={<Button>New record</Button>} title="Create record" description="A scoring job is queued automatically via the playground.record.created event.">
      {(close) => (
        <ActionForm action={createRecordAction} onSuccess={close} resetOnSuccess>
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" placeholder="Refund for order #4821" required autoFocus />
            <FieldError name="title" />
          </Field>
          <Field label="Amount" htmlFor="amount" hint="Try an unusually large number to trigger the outlier flag.">
            <Input id="amount" name="amount" type="number" step="0.01" min={0} defaultValue="120" required />
            <FieldError name="amount" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function RecordActions({
  id,
  status,
  canSubmit,
  canDelete,
  canRescore,
}: {
  id: string;
  status: string;
  canSubmit: boolean;
  canDelete: boolean;
  canRescore: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      {canSubmit && (status === "DRAFT" || status === "REJECTED") && (
        <InlineAction action={submitRecordAction} values={{ id }} size="sm" variant="secondary">
          Submit for approval
        </InlineAction>
      )}
      {canRescore && (
        <InlineAction action={rescoreRecordAction} values={{ id }} size="sm" variant="ghost">
          Re-score
        </InlineAction>
      )}
      {canDelete && (
        <InlineAction action={deleteRecordAction} values={{ id }} size="sm" variant="ghost" confirm="Delete this record?">
          Delete
        </InlineAction>
      )}
    </div>
  );
}

/**
 * Flag-gated rendering. `useFlag` is seeded with the server's evaluation and updated over SSE —
 * toggle `playground.advanced-scoring` in Feature Flags and this changes without a reload.
 */
export function RiskScore({ score }: { score: number | null }) {
  const advanced = useFlag("playground.advanced-scoring");
  if (score === null) return <span className="text-xs text-muted">scoring…</span>;
  const tone = score >= 0.66 ? "danger" : score >= 0.33 ? "warning" : "success";
  if (!advanced) return <Badge tone={tone}>{score >= 0.66 ? "outlier" : "normal"}</Badge>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
        <div className={`h-full ${tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-success"}`} style={{ width: `${score * 100}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums">{score.toFixed(2)}</span>
    </div>
  );
}
