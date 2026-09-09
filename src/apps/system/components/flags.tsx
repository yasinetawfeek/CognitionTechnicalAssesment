"use client";

import { ActionForm, Button, Checkbox, cn, Dialog, Field, FieldError, InlineAction, Input, SubmitButton } from "@/kernel/ui";
import type { FlagRules } from "@/kernel/flags";
import { deleteFlagAction, saveFlagAction, toggleFlagAction } from "../actions";

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  return (
    <InlineAction
      action={toggleFlagAction}
      values={{ key: flagKey }}
      variant="ghost"
      size="sm"
      className={cn("min-w-14 font-semibold", enabled ? "text-success" : "text-muted")}
      aria-label={`Toggle ${flagKey}`}
    >
      <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", enabled ? "bg-success" : "bg-border")} />
      {enabled ? "ON" : "OFF"}
    </InlineAction>
  );
}

export function FlagDialog({
  flag,
  roleKeys,
}: {
  flag?: { key: string; description: string; enabled: boolean; ownerAppId: string; rules: FlagRules | null };
  roleKeys: string[];
}) {
  const editing = !!flag;
  return (
    <Dialog
      trigger={editing ? <Button variant="ghost" size="sm">Edit</Button> : <Button>New flag</Button>}
      title={editing ? `Edit ${flag.key}` : "Create feature flag"}
      description="Targeting rules are evaluated in order: user allow-list, then roles, then percentage."
    >
      {(close) => (
        <>
        <ActionForm action={saveFlagAction} onSuccess={close}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Key" htmlFor="key" hint="e.g. kyc.ml-outlier-scores">
              <Input id="key" name="key" defaultValue={flag?.key} readOnly={editing} required autoFocus={!editing} className={editing ? "opacity-60" : ""} />
              <FieldError name="key" />
            </Field>
            <Field label="Owner app" htmlFor="ownerAppId">
              <Input id="ownerAppId" name="ownerAppId" defaultValue={flag?.ownerAppId ?? "kernel"} />
            </Field>
          </div>
          <Field label="Description" htmlFor="description">
            <Input id="description" name="description" defaultValue={flag?.description} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="enabled" defaultChecked={flag?.enabled ?? false} /> Enabled
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Roles (comma separated)" htmlFor="roles" hint={roleKeys.join(", ")}>
              <Input id="roles" name="roles" defaultValue={flag?.rules?.roles?.join(", ")} />
            </Field>
            <Field label="User emails (comma separated)" htmlFor="users">
              <Input id="users" name="users" defaultValue={flag?.rules?.users?.join(", ")} />
            </Field>
          </div>
          <Field label="Percentage rollout" htmlFor="percentage" hint="0–100. Stable per user. Blank or 100 = everyone matching the other rules.">
            <Input id="percentage" name="percentage" type="number" min={0} max={100} defaultValue={flag?.rules?.percentage} />
            <FieldError name="percentage" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton>{editing ? "Save" : "Create"}</SubmitButton>
          </div>
          </ActionForm>
          {editing && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted">Apps evaluating a deleted flag see false.</span>
              <InlineAction
                action={async (prev, fd) => {
                  const r = await deleteFlagAction(prev, fd);
                  if (r.ok) close();
                  return r;
                }}
                values={{ key: flag.key }}
                variant="danger"
                size="sm"
                confirm={`Delete ${flag.key}?`}
              >
                Delete flag
              </InlineAction>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
