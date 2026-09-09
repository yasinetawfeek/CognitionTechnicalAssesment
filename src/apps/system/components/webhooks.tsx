"use client";

import { useState } from "react";
import { ActionForm, Alert, Button, CopyButton, Dialog, Field, FieldError, Input, SubmitButton } from "@/kernel/ui";
import { createWebhookAction } from "../actions";

export function CreateWebhookDialog() {
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <Dialog
      trigger={<Button>New subscription</Button>}
      title="New webhook subscription"
      description="The receiver should verify X-Kernel-Signature: sha256=HMAC(secret, body)."
      onOpenChange={(o) => !o && setSecret(null)}
    >
      {(close) =>
        secret ? (
          <div className="space-y-4">
            <Alert tone="success" title="Subscription created">
              Copy the signing secret now — it is only shown once.
            </Alert>
            <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2">
              <code className="flex-1 break-all font-mono text-xs">{secret}</code>
              <CopyButton value={secret} />
            </div>
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <ActionForm action={createWebhookAction} onSuccess={(s) => setSecret(s.data?.secret ?? null)} resetOnSuccess>
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" placeholder="Slack #risk-alerts" required autoFocus />
              <FieldError name="name" />
            </Field>
            <Field label="URL" htmlFor="url">
              <Input id="url" name="url" type="url" placeholder="https://hooks.example.com/kernel" required />
              <FieldError name="url" />
            </Field>
            <Field label="Event patterns" htmlFor="eventTypes" hint="Comma separated, wildcards allowed: flag.*, kyc.case.decided">
              <Input id="eventTypes" name="eventTypes" defaultValue="flag.*" required />
              <FieldError name="eventTypes" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <SubmitButton pendingText="Creating…">Create</SubmitButton>
            </div>
          </ActionForm>
        )
      }
    </Dialog>
  );
}
