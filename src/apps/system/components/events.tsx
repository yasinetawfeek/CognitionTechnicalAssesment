"use client";

import { useState } from "react";
import { ActionForm, Button, Dialog, Field, FieldError, Input, JsonView, SubmitButton, Textarea } from "@/kernel/ui";
import { publishTestEventAction } from "../actions";

export function EventPayload({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(value);
  if (text.length < 60) return <span className="font-mono text-xs text-muted">{text}</span>;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="font-mono text-xs text-primary hover:underline">
        {open ? "hide" : `${text.slice(0, 50)}…`}
      </button>
      {open && <JsonView value={value} className="mt-1" />}
    </div>
  );
}

export function PublishEventDialog() {
  return (
    <Dialog
      trigger={<Button variant="secondary">Publish test event</Button>}
      title="Publish an event"
      description="Handy for testing subscribers, SSE clients and webhooks without touching real data."
    >
      {(close) => (
        <ActionForm action={publishTestEventAction} onSuccess={close} resetOnSuccess>
          <Field label="Type" htmlFor="type" hint="Dotted lowercase, e.g. demo.ping">
            <Input id="type" name="type" defaultValue="demo.ping" required autoFocus />
            <FieldError name="type" />
          </Field>
          <Field label="Payload (JSON)" htmlFor="payload">
            <Textarea id="payload" name="payload" rows={4} defaultValue='{ "hello": "world" }' className="font-mono text-xs" />
            <FieldError name="payload" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Publishing…">Publish</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
