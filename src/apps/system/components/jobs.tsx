"use client";

import { useState } from "react";
import { ActionForm, Button, Dialog, Field, FieldError, InlineAction, Input, JsonView, Select, SubmitButton, Textarea } from "@/kernel/ui";
import { enqueueJobAction, retryJobAction } from "../actions";

export function RetryJobButton({ id }: { id: string }) {
  return (
    <InlineAction action={retryJobAction} values={{ id }} variant="secondary" size="sm">
      Retry
    </InlineAction>
  );
}

export function JobResult({ status, result, error, payload }: { status: string; result: unknown; error: string | null; payload: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-md">
      {status === "FAILED" && error && <p className="truncate text-xs text-danger" title={error}>{error}</p>}
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-primary hover:underline">
        {open ? "hide" : "details"}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted">payload</p>
          <JsonView value={payload} />
          {result !== null && result !== undefined && (
            <>
              <p className="text-[11px] uppercase tracking-wide text-muted">result</p>
              <JsonView value={result} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function EnqueueJobDialog({ handlers }: { handlers: string[] }) {
  return (
    <Dialog trigger={<Button variant="secondary">Enqueue job</Button>} title="Enqueue a job" description="Runs on the next worker tick (~2s).">
      {(close) => (
        <ActionForm action={enqueueJobAction} onSuccess={close} resetOnSuccess>
          <Field label="Type" htmlFor="type">
            {handlers.length ? (
              <Select id="type" name="type" defaultValue={handlers[0]}>
                {handlers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="type" name="type" placeholder="no handlers registered" required />
            )}
            <FieldError name="type" />
          </Field>
          <Field label="Payload (JSON)" htmlFor="payload">
            <Textarea id="payload" name="payload" rows={4} defaultValue="{}" className="font-mono text-xs" />
            <FieldError name="payload" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Queuing…">Enqueue</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
