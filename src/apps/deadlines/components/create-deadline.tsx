"use client";

import { useState } from "react";
import { ActionForm, Button, Dialog, Field, FieldError, Input, Select, SubmitButton, Textarea } from "@/kernel/ui";
import { createDeadlineAction } from "../actions";
import { CATEGORIES, VISIBILITIES } from "../types";

export function CreateDeadlineDialog({
  roles,
  users,
  defaultOwnerId,
}: {
  roles: { key: string; name: string }[];
  users: { id: string; name: string; email: string }[];
  defaultOwnerId: string;
}) {
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>("EVERYONE");
  return (
    <Dialog
      trigger={<Button>New deadline</Button>}
      title="New financial deadline"
      description="Reminders are sent to everyone the deadline is visible to, 14 / 7 / 1 days out and once overdue."
    >
      {(close) => (
        <ActionForm action={createDeadlineAction} onSuccess={close} resetOnSuccess>
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" placeholder="Q1 VAT return filing" required autoFocus />
            <FieldError name="title" />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" placeholder="What has to be filed, and with whom." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="category">
              <Select id="category" name="category" defaultValue="REGULATORY">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <FieldError name="category" />
            </Field>
            <Field label="Entity / desk" htmlFor="entity">
              <Input id="entity" name="entity" placeholder="Acme Payments Ltd" />
            </Field>
            <Field label="Due" htmlFor="dueAt">
              <Input id="dueAt" name="dueAt" type="datetime-local" required />
              <FieldError name="dueAt" />
            </Field>
            <Field label="Owner" htmlFor="ownerId">
              <Select id="ownerId" name="ownerId" defaultValue={defaultOwnerId}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <FieldError name="ownerId" />
            </Field>
          </div>
          <Field label="Visible to" htmlFor="visibility" hint="Role- and user-scoped deadlines stay hidden from everyone else, including in reminders.">
            <Select id="visibility" name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
              <option value="EVERYONE">Everyone with app access</option>
              <option value="ROLES">Specific roles</option>
              <option value="USERS">Specific people</option>
            </Select>
          </Field>
          {visibility === "ROLES" && (
            <Field label="Roles" htmlFor="visibleRoles">
              <Select id="visibleRoles" name="visibleRoles[]" multiple size={Math.min(6, roles.length)}>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <FieldError name="visibleRoles" />
            </Field>
          )}
          {visibility === "USERS" && (
            <Field label="People" htmlFor="visibleUsers">
              <Select id="visibleUsers" name="visibleUsers[]" multiple size={Math.min(6, users.length)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </Select>
              <FieldError name="visibleUsers" />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create deadline</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
