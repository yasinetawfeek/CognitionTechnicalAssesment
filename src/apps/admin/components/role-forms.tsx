"use client";

import { useRouter } from "next/navigation";
import { ActionForm, Button, Checkbox, Dialog, Field, FieldError, InlineAction, Input, SubmitButton, Textarea } from "@/kernel/ui";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "../actions";

export type PermissionGroup = { app: string; name: string; permissions: { key: string; description: string }[] };

export function PermissionPicker({ groups, selected = [] }: { groups: PermissionGroup[]; selected?: string[] }) {
  return (
    <Field label="Permissions" hint="Wildcards are supported when editing roles via the API, e.g. kyc.*">
      <div className="max-h-80 space-y-4 overflow-y-auto rounded-md border border-border p-3">
        {groups.map((g) => (
          <div key={g.app}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g.name}</p>
            <div className="space-y-1">
              {g.permissions.map((p) => (
                <label key={p.key} className="flex items-start gap-2 text-sm">
                  <Checkbox name="permissions[]" value={p.key} defaultChecked={selected.includes(p.key)} className="mt-0.5" />
                  <span>
                    <span className="font-mono text-xs">{p.key}</span>
                    <span className="block text-xs text-muted">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Field>
  );
}

export function CreateRoleDialog({ groups }: { groups: PermissionGroup[] }) {
  return (
    <Dialog trigger={<Button>New role</Button>} title="Create role">
      {(close) => (
        <ActionForm action={createRoleAction} onSuccess={close} resetOnSuccess>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Key" htmlFor="key" hint="Stable identifier, e.g. kyc_reviewer">
              <Input id="key" name="key" required pattern="[a-z][a-z0-9_]*" autoFocus />
              <FieldError name="key" />
            </Field>
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" required />
              <FieldError name="name" />
            </Field>
          </div>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" rows={2} />
          </Field>
          <PermissionPicker groups={groups} />
          <FieldError name="permissions" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create role</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditRoleForm({
  role,
  groups,
}: {
  role: { id: string; key: string; name: string; description: string; isSystem: boolean; permissions: string[]; userCount: number };
  groups: PermissionGroup[];
}) {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <ActionForm action={updateRoleAction}>
        <input type="hidden" name="id" value={role.id} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Key">
            <Input value={role.key} disabled />
          </Field>
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" defaultValue={role.name} required />
            <FieldError name="name" />
          </Field>
        </div>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" name="description" rows={2} defaultValue={role.description} />
        </Field>
        <PermissionPicker groups={groups} selected={role.permissions} />
        <FieldError name="permissions" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => router.push("/admin/roles")}>
            Back
          </Button>
          <SubmitButton>Save role</SubmitButton>
        </div>
      </ActionForm>
      {!role.isSystem && (
        <div className="flex items-center justify-between rounded-md border border-danger/30 bg-danger-soft/40 px-4 py-3">
          <p className="text-sm">
            Delete this role{role.userCount > 0 ? ` (assigned to ${role.userCount} user${role.userCount === 1 ? "" : "s"})` : ""}.
          </p>
          <InlineAction
            action={async (prev, fd) => {
              const r = await deleteRoleAction(prev, fd);
              if (r.ok) router.push("/admin/roles");
              return r;
            }}
            values={{ id: role.id }}
            variant="danger"
            size="sm"
            confirm="Delete this role? Users lose its permissions immediately."
          >
            Delete role
          </InlineAction>
        </div>
      )}
    </div>
  );
}
