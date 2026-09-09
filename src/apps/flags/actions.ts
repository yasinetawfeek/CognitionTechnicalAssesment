"use server";

import { z } from "zod";
import { action, formField, parseForm } from "@/kernel/actions";
import { requireUser } from "@/kernel/context";
import { deleteFlag, toggleFlag, upsertFlag, type FlagRules } from "@/kernel/flags";
import { ValidationError } from "@/kernel/errors";

export const toggleFlagAction = action(async (formData) => {
  const ctx = await requireUser();
  const { key } = parseForm(z.object({ key: z.string() }), formData);
  const flag = await toggleFlag(ctx, key);
  return { ok: true, message: `${flag.key} is now ${flag.enabled ? "ON" : "OFF"}` };
});

const csv = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  z.array(z.string()),
);

export const saveFlagAction = action(async (formData) => {
  const ctx = await requireUser();
  const input = parseForm(
    z.object({
      key: z.string().min(1),
      description: formField.optionalString,
      enabled: formField.checkbox,
      ownerAppId: formField.optionalString,
      users: csv,
      roles: csv,
      percentage: formField.optionalString,
    }),
    formData,
  );
  const pct = input.percentage === undefined ? undefined : Number(input.percentage);
  if (pct !== undefined && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
    throw new ValidationError({ percentage: ["Must be between 0 and 100"] });
  }
  const rules: FlagRules = {};
  if (input.users.length) rules.users = input.users;
  if (input.roles.length) rules.roles = input.roles;
  if (pct !== undefined && pct < 100) rules.percentage = pct;
  await upsertFlag(ctx, {
    key: input.key,
    description: input.description ?? "",
    enabled: input.enabled,
    ownerAppId: input.ownerAppId,
    rules: Object.keys(rules).length ? rules : null,
  });
  return { ok: true, message: "Flag saved" };
});

export const deleteFlagAction = action(async (formData) => {
  const ctx = await requireUser();
  const { key } = parseForm(z.object({ key: z.string() }), formData);
  await deleteFlag(ctx, key);
  return { ok: true };
});
