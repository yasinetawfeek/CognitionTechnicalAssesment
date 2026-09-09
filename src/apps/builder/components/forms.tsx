"use client";

import { useRouter } from "next/navigation";
import { ActionForm, Button, Dialog, Field, FieldError, InlineAction, Input, SubmitButton, Textarea } from "@/kernel/ui";
import { createAppRequestAction, retryBuildAction, submitForReviewAction } from "../actions";

export function NewAppDialog() {
  const router = useRouter();
  return (
    <Dialog
      trigger={<Button>Request an app</Button>}
      title="Request a new app"
      description="Describe it in plain English. Devin scaffolds it on a branch using the kernel's app contract; you get a preview to test before an admin reviews it."
    >
      {(close) => (
        <ActionForm
          action={createAppRequestAction}
          onSuccess={(res) => {
            close();
            if (res.data?.id) router.push(`/builder/${res.data.id}`);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="App name" htmlFor="name">
              <Input id="name" name="name" placeholder="Refunds Dashboard" required autoFocus />
              <FieldError name="name" />
            </Field>
            <Field label="App id" htmlFor="appId" hint="Route prefix and permission namespace">
              <Input id="appId" name="appId" placeholder="refunds" pattern="[a-z][a-z0-9-]*" required />
              <FieldError name="appId" />
            </Field>
          </div>
          <Field label="What is it for?" htmlFor="purpose">
            <Textarea id="purpose" name="purpose" rows={2} placeholder="Ops needs one place to see, approve and issue customer refunds instead of the Power Apps dashboard." required />
            <FieldError name="purpose" />
          </Field>
          <Field label="Requirements" htmlFor="requirements" hint="Screens, data, who can do what. Approvals, audit and flags come from the kernel for free.">
            <Textarea
              id="requirements"
              name="requirements"
              rows={5}
              placeholder={"- Queue of refund requests with amount, customer, reason\n- Agents can create; team leads approve (four-eyes) above £500\n- Export to CSV"}
              required
            />
            <FieldError name="requirements" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Queuing…">Build it</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function SubmitForReviewForm({ id }: { id: string }) {
  return (
    <ActionForm action={submitForReviewAction}>
      <input type="hidden" name="id" value={id} />
      <Field label="Test notes for the reviewer" htmlFor="testNotes" hint="What you tried in the preview and anything the admin should look at.">
        <Textarea id="testNotes" name="testNotes" rows={3} placeholder="Created a refund, approved it as a second user, checked the audit log." />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Sending…">Send for admin review</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RetryBuildButton({ id }: { id: string }) {
  return (
    <InlineAction action={retryBuildAction} values={{ id }} variant="secondary" size="sm">
      Rebuild
    </InlineAction>
  );
}
