# AGENTS.md — working in this repo

Internal-tools **kernel** (Next.js 15 App Router, TypeScript, Prisma + SQLite, Tailwind v4).
Apps live in `src/apps/<id>`; kernel code lives in `src/kernel`. Read `docs/APP_AUTHORING.md`
before adding an app.

## Setup & verification

```bash
cp .env.example .env && npm run setup     # install, prisma generate, db push, seed
npm run dev                               # http://localhost:3000 (demo users: *@demo.local / password123)
npm run lint && npm run typecheck && npm run test && npm run build
```

Schema changed? `npm run db:push` (dev) — then update `prisma/seed.ts`. `npm run db:reset` wipes the DB.

## Layout

```
src/kernel/         auth, rbac, audit, events, flags, approvals, jobs, notifications, apps (registry), ui
src/apps/<id>/      manifest.ts  actions.ts  server.ts  pages/  components/
src/apps/index.ts   list of manifests (registry)      src/apps/server.ts  boot-time hooks
src/app/(shell)/    authenticated routes (one folder per app) — thin wrappers around src/apps/*/pages
src/app/api/        auth + kernel HTTP endpoints (SSE stream, flags, health)
src/instrumentation.ts  boots app hooks + job worker (Node runtime only)
```

## Conventions

- New app: `npm run create-app -- <id> "<Name>" --icon <LucideIcon> --category <operations|engineering|finance|other>`.
- Permissions: `<app>.<resource>.<action>`, declared in the manifest. Check with `requirePermission()` in
  actions and `pageContext()` in pages. Never query `db` from a page/action without a permission check.
- Every privileged write: `ctx.audit({...})` **and** `publish({ type: "<app>.<entity>.<verb>", ... })`.
- Server actions: wrap with `action()`, parse with `parseForm(zodSchema, formData)`. Return `{ ok: true, message? }`.
- Client forms: `ActionForm` + `Field` + `SubmitButton` from `@/kernel/ui`; one-click buttons: `InlineAction`.
- Live UI: `<LiveRefresh patterns={[...]} />` (server components) or `useKernelEvents` / `useFlag` (client).
- Sensitive decisions: `requestApproval` + `registerApprovalHandler` (four-eyes is enforced by the kernel).
- Async / ML work: `registerJobHandler` in `server.ts`, `enqueueJob` from actions or subscribers.
- Node-only modules (`node:crypto`, Prisma, job worker) must not be imported from client components or
  `middleware.ts`; `instrumentation.ts` gates them behind `NEXT_RUNTIME === "nodejs"`.
- Keep the kernel generic: business rules belong in apps.

## Do not

- Commit `.env` or `prisma/*.db`.
- Bypass `action()` / `requirePermission()` for convenience.
- Add a second UI toolkit; extend `src/kernel/ui` instead.
