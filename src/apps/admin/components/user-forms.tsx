"use client";

import { useRouter } from "next/navigation";
import { ActionForm, Button, Checkbox, Dialog, Field, FieldError, Input, Select, SubmitButton } from "@/kernel/ui";
import { createUserAction, updateUserAction } from "../actions";

type RoleOpt = { id: string; name: string };

function RolePicker({ roles, selected = [] }: { roles: RoleOpt[]; selected?: string[] }) {
  return (
    <Field label="Roles">
      <div className="grid grid-cols-2 gap-2">
        {roles.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm">
            <Checkbox name="roleIds[]" value={r.id} defaultChecked={selected.includes(r.id)} />
            {r.name}
          </label>
        ))}
      </div>
    </Field>
  );
}

export function CreateUserDialog({ roles }: { roles: RoleOpt[] }) {
  return (
    <Dialog trigger={<Button>New user</Button>} title="Create user" description="Password accounts only; SSO users are provisioned on first login.">
      {(close) => (
        <ActionForm action={createUserAction} onSuccess={close} resetOnSuccess>
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" required autoFocus />
            <FieldError name="name" />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required />
            <FieldError name="email" />
          </Field>
          <Field label="Temporary password" htmlFor="password" hint="Leave blank to create an SSO-only account.">
            <Input id="password" name="password" type="text" autoComplete="off" />
          </Field>
          <RolePicker roles={roles} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create user</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditUserForm({
  user,
  roles,
}: {
  user: { id: string; name: string; email: string; status: string; roleIds: string[] };
  roles: RoleOpt[];
}) {
  const router = useRouter();
  return (
    <ActionForm action={updateUserAction} onSuccess={() => router.push("/admin")}>
      <input type="hidden" name="id" value={user.id} />
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" defaultValue={user.name} required />
        <FieldError name="name" />
      </Field>
      <Field label="Email">
        <Input value={user.email} disabled />
      </Field>
      <Field label="Status" htmlFor="status" hint="Disabling a user ends all their sessions immediately.">
        <Select id="status" name="status" defaultValue={user.status}>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </Select>
      </Field>
      <Field label="Reset password" htmlFor="password" hint="Leave blank to keep the current password.">
        <Input id="password" name="password" type="text" autoComplete="off" />
      </Field>
      <RolePicker roles={roles} selected={user.roleIds} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={() => router.push("/admin")}>
          Cancel
        </Button>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </ActionForm>
  );
}
