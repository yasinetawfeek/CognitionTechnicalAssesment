"use server";

import { z } from "zod";
import { action, parseForm } from "@/kernel/actions";
import { requireUser } from "@/kernel/context";
import { installApp, uninstallApp } from "@/kernel/apps/installs";

const schema = z.object({ appId: z.string().min(1) });

export const installAppAction = action(async (formData) => {
  const ctx = await requireUser();
  const { appId } = parseForm(schema, formData);
  const app = await installApp(ctx, appId);
  return { ok: true, message: `${app.name} added to My apps` };
});

export const uninstallAppAction = action(async (formData) => {
  const ctx = await requireUser();
  const { appId } = parseForm(schema, formData);
  const app = await uninstallApp(ctx, appId);
  return { ok: true, message: `${app.name} removed from My apps` };
});
