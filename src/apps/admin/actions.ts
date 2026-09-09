"use server";

import { z } from "zod";
import { action, formField, parseForm } from "@/kernel/actions";
import { requireUser } from "@/kernel/context";
import { createRole, createUser, deleteRole, updateRole, updateUser } from "@/kernel/rbac";

export const createUserAction = action(async (formData) => {
  const ctx = await requireUser();
  const input = parseForm(
    z.object({
      email: z.string().email(),
      name: z.string().min(1, "Name is required"),
      password: formField.optionalString,
      roleIds: formField.list,
    }),
    formData,
  );
  const user = await createUser(ctx, input);
  return { ok: true, message: `Created ${user.email}` };
});

export const updateUserAction = action(async (formData) => {
  const ctx = await requireUser();
  const input = parseForm(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      status: z.enum(["ACTIVE", "DISABLED"]),
      password: formField.optionalString,
      roleIds: formField.list,
    }),
    formData,
  );
  await updateUser(ctx, input.id, input);
  return { ok: true, message: "User updated" };
});

export const toggleUserStatusAction = action(async (formData) => {
  const ctx = await requireUser();
  const { id, status } = parseForm(z.object({ id: z.string(), status: z.enum(["ACTIVE", "DISABLED"]) }), formData);
  await updateUser(ctx, id, { status });
  return { ok: true };
});

export const createRoleAction = action(async (formData) => {
  const ctx = await requireUser();
  const input = parseForm(
    z.object({
      key: z.string().min(1),
      name: z.string().min(1),
      description: formField.optionalString,
      permissions: formField.list,
    }),
    formData,
  );
  const role = await createRole(ctx, input);
  return { ok: true, message: `Created role ${role.name}` };
});

export const updateRoleAction = action(async (formData) => {
  const ctx = await requireUser();
  const input = parseForm(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      description: formField.optionalString,
      permissions: formField.list,
    }),
    formData,
  );
  await updateRole(ctx, input.id, input);
  return { ok: true, message: "Role updated" };
});

export const deleteRoleAction = action(async (formData) => {
  const ctx = await requireUser();
  const { id } = parseForm(z.object({ id: z.string() }), formData);
  await deleteRole(ctx, id);
  return { ok: true };
});
