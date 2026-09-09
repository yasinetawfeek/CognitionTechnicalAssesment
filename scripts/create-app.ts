/**
 * Scaffold a new app on the kernel.
 *
 *   npm run create-app -- kyc "KYC Review" --icon UserCheck --category operations
 *
 * Generates src/apps/<id>/{manifest,actions,server}.ts, a first page + route, and registers the
 * app in src/apps/index.ts and src/apps/server.ts. Then: add Prisma models, `npm run db:push`,
 * grant `<id>.access` to a role, and start building.
 */
import fs from "node:fs";
import path from "node:path";

const [id, nameArg, ...rest] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: npm run create-app -- <id> "<Display name>" [--icon Box] [--category operations|engineering|finance|other]');
  process.exit(1);
}
const name = nameArg ?? id[0].toUpperCase() + id.slice(1);
const opt = (flag: string, fallback: string) => {
  const i = rest.indexOf(flag);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
};
const icon = opt("--icon", "Box");
const category = opt("--category", "operations");
const camel = id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "src/apps", id);
const routeDir = path.join(root, "src/app/(shell)", id);

if (fs.existsSync(appDir)) {
  console.error(`src/apps/${id} already exists`);
  process.exit(1);
}

const files: Record<string, string> = {
  [`${appDir}/manifest.ts`]: `import { defineApp } from "@/kernel/apps/types";

export const ${camel}App = defineApp({
  id: "${id}",
  name: "${name}",
  description: "TODO: one-line description shown in the launcher",
  icon: "${icon}",
  category: "${category}",
  permissions: [
    { key: "${id}.item.read", description: "View items" },
    { key: "${id}.item.write", description: "Create and edit items" },
  ],
  events: [{ type: "${id}.item.created", description: "An item was created" }],
  nav: [{ label: "Overview", path: "" }],
});
`,
  [`${appDir}/actions.ts`]: `"use server";

import { z } from "zod";
import { action, parseForm } from "@/kernel/actions";
import { requirePermission } from "@/kernel/context";
import { publish } from "@/kernel/events/bus";

export const createItemAction = action(async (formData) => {
  const ctx = await requirePermission("${id}.item.write");
  const input = parseForm(z.object({ title: z.string().min(1) }), formData);
  // const item = await db.${camel}Item.create({ data: { ...input, createdById: ctx.user.id } });
  await ctx.audit({ appId: "${id}", action: "item.create", targetType: "${name.replace(/\s+/g, "")}Item", after: input });
  await publish({ type: "${id}.item.created", sourceAppId: "${id}", actorId: ctx.user.id, payload: input });
  return { ok: true, message: \`Created \${input.title}\` };
});
`,
  [`${appDir}/server.ts`]: `/**
 * Server-side hooks (event subscribers, approval handlers, job handlers).
 * Imported once at boot via src/apps/server.ts.
 */
import { subscribe } from "@/kernel/events/bus";

subscribe("flag.updated", "${id}.on-flag", async (event) => {
  // React to kernel or other apps' events here.
  void event;
});
`,
  [`${appDir}/pages/overview.tsx`]: `import { pageContext } from "@/kernel/context";
import { EmptyState, LiveRefresh, PageHeader } from "@/kernel/ui";
import { CreateItemDialog } from "../components/create-item";

export default async function OverviewPage() {
  const ctx = await pageContext("${id}.item.read", "/${id}");
  return (
    <>
      <LiveRefresh patterns={["${id}.*"]} />
      <PageHeader title="${name}" description="Replace me." actions={ctx.can("${id}.item.write") && <CreateItemDialog />} />
      <EmptyState title="Nothing here yet" description="Add a Prisma model, query it with db.*, and render a <DataTable>." />
    </>
  );
}
`,
  [`${appDir}/components/create-item.tsx`]: `"use client";

import { ActionForm, Button, Dialog, Field, FieldError, Input, SubmitButton } from "@/kernel/ui";
import { createItemAction } from "../actions";

export function CreateItemDialog() {
  return (
    <Dialog trigger={<Button>New item</Button>} title="New item">
      {(close) => (
        <ActionForm action={createItemAction} onSuccess={close} resetOnSuccess>
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" required autoFocus />
            <FieldError name="title" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <SubmitButton pendingText="Saving…">Create</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
`,
  [`${routeDir}/layout.tsx`]: `import type { ReactNode } from "react";
import { AppFrame } from "@/kernel/ui/shell/app-frame";

export default function Layout({ children }: { children: ReactNode }) {
  return <AppFrame appId="${id}">{children}</AppFrame>;
}
`,
  [`${routeDir}/page.tsx`]: `export { default } from "@/apps/${id}/pages/overview";\n`,
};

for (const [file, content] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log("  created", path.relative(root, file));
}

const indexPath = path.join(root, "src/apps/index.ts");
let index = fs.readFileSync(indexPath, "utf8");
index = index.replace(/(import[^\n]*\n)(?![\s\S]*import)/, `$1import { ${camel}App } from "./${id}/manifest";\n`);
index = index.replace(/(export const apps: AppManifest\[\] = \[)([^\]]*)\]/, (_, a: string, b: string) => `${a}${b.trimEnd()}${b.trim().endsWith(",") ? "" : ","} ${camel}App]`);
fs.writeFileSync(indexPath, index);

const serverPath = path.join(root, "src/apps/server.ts");
let server = fs.readFileSync(serverPath, "utf8");
server = server.replace(/(\n\})\s*$/, `\n  await import("./${id}/server");$1\n`);
fs.writeFileSync(serverPath, server);

console.log(`
Registered "${id}" in src/apps/index.ts and src/apps/server.ts.

Next:
  1. Add models to prisma/schema.prisma  →  npm run db:push
  2. Grant "${id}.access" (and ${id}.item.*) to a role in Users & Roles
  3. Open http://localhost:3000/${id}
`);
