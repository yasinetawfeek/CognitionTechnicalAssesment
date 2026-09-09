# Building an app on the kernel

An "app" is a folder under `src/apps/<id>/` plus its routes under `src/app/(shell)/<id>/`.
The kernel supplies auth, RBAC, audit, events, flags, approvals, jobs, notifications and UI.
An app should contain only its **domain model, actions and pages**.

The Playground app (`src/apps/playground`) is the reference implementation of everything below.

## 1. Scaffold

```bash
npm run create-app -- kyc "KYC Review" --icon UserCheck --category operations
```

Generates and registers:

```
src/apps/kyc/
  manifest.ts          # defineApp({...}) – id, nav, permissions, events
  actions.ts           # "use server" actions wrapped in action()
  server.ts            # boot-time hooks: approval handlers, job handlers, subscribers
  pages/overview.tsx   # server component page body
  components/*.tsx     # client components (forms, dialogs)
src/app/(shell)/kyc/
  layout.tsx           # requireAppAccess("kyc") + app sub-nav
  page.tsx
```

Then add your Prisma models to `prisma/schema.prisma` and run `npm run db:push`.

## 2. Manifest

```ts
export const kycApp = defineApp({
  id: "kyc",
  name: "KYC Review",
  icon: "UserCheck",                       // any lucide icon name
  category: "operations",
  flag: "kyc.enabled",                     // optional: hide app unless flag is on
  permissions: [
    { key: "kyc.case.read",   description: "View cases" },
    { key: "kyc.case.decide", description: "Approve/reject a case" },
  ],
  events: [{ type: "kyc.case.decided", description: "A case was approved or rejected" }],
  nav: [{ label: "Queue", path: "" }, { label: "Stats", path: "/stats" }],
});
```

Rules:
- Permission keys are `<appId>.<resource>.<action>`. The kernel adds `<appId>.access` automatically;
  a user needs it (or a wildcard such as `kyc.*` / `*`) to see the app at all.
- Declared permissions appear in **Admin → Permissions** and in the role editor; declared events
  appear in **System → Events / Webhooks**.

## 3. Auth & RBAC in code

```ts
import { requirePermission, requireUser, pageContext } from "@/kernel/context";

// Server actions / route handlers
const ctx = await requirePermission("kyc.case.decide");   // 403 if missing
ctx.can("kyc.case.override");                             // boolean check
ctx.require("kyc.case.override");                         // throws ForbiddenError

// Pages: redirects to /login or /forbidden instead of throwing
const ctx = await pageContext("kyc.case.read");
```

`ctx.user` has `{ id, email, name, roles, permissions }`.

## 4. Server actions & forms

```ts
"use server";
export const decideCaseAction = action(async (formData) => {
  const ctx = await requirePermission("kyc.case.decide");
  const { id, decision } = parseForm(z.object({ id: z.string(), decision: z.enum(["APPROVE", "REJECT"]) }), formData);
  ...
  return { ok: true, message: "Decided" };
});
```

- `action()` maps kernel errors (`ForbiddenError`, `NotFoundError`, `ValidationError`, ...) to
  `{ ok: false, error, issues }` so the UI never sees stack traces.
- `parseForm(schema, formData)` parses with zod; use `formField.checkbox / number / optionalString` for coercions.
- In the client, use `<ActionForm action={decideCaseAction}>` with `<Field>`, `<Input>`, `<SubmitButton>`,
  `<FieldError name="..."/>`. `InlineAction` renders a one-click button form (toggle, retry, approve).

## 5. Audit

Every privileged write should record an audit entry via the context:

```ts
await ctx.audit({ appId: "kyc", action: "case.decide", targetType: "KycCase", targetId: id, before, after });
```

Entries are hash-chained; **Audit → Verify** recomputes the chain.

## 6. Events (cross-app propagation)

```ts
// publish
await publish({ type: "kyc.case.decided", sourceAppId: "kyc", actorId: ctx.user.id, payload: { caseId } });

// subscribe on the server (server.ts) – runs in-process
subscribe("flag.*", "kyc:flag-watcher", async (e) => { ... });

// subscribe in the browser
<LiveRefresh patterns={["kyc.*", "approval.*"]} />          // router.refresh() on match
const events = useKernelEvents(["kyc.case.decided"]);        // raw event list
```

Patterns: exact `kyc.case.decided`, prefix `kyc.*`, or `*`. The browser holds a single SSE
connection (`/api/kernel/events/stream`) shared by all hooks. Outbound webhooks (System → Webhooks)
receive the same events, HMAC-signed.

## 7. Feature flags

```ts
// server
if (await isEnabled("kyc.auto-approve-low-risk", ctx.user)) ...

// client
const on = useFlag("kyc.beta-panel");
```

Flags evaluate global / user / role / percentage rules, cache for 30s, and invalidate on `flag.*`
events. Client `useFlag` re-fetches when a flag event arrives, so flipping a flag in the admin
surface updates every open app without a reload.

## 8. Approvals (maker-checker)

```ts
// maker side
await requestApproval(ctx, {
  appId: "kyc", type: "kyc.case.approve", title: `Approve case ${id}`,
  payload: { caseId: id }, requiredPermission: "kyc.case.decide",
});

// server.ts – the kernel calls this when a different user decides
registerApprovalHandler<{ caseId: string }>("kyc.case.approve", {
  onApproved: async (req, ctx) => { ... },
  onRejected: async (req, ctx) => { ... },
});
```

The kernel enforces the four-eyes rule (requester cannot approve their own request), notifies
permission holders, audits, and publishes `approval.*` events.

## 9. Background jobs & ML

```ts
// server.ts
registerJobHandler<{ caseId: string }, { score: number }>("kyc.score-case", async ({ caseId }) => {
  const res = await fetch(`${process.env.ML_SERVICE_URL}/score`, { method: "POST", body: JSON.stringify({ caseId }) });
  const { score } = await res.json();
  await db.kycCase.update({ where: { id: caseId }, data: { riskScore: score } });
  await publish({ type: "kyc.case.scored", sourceAppId: "kyc", actorId: null, payload: { caseId, score } });
  return { score };
});

// anywhere
await enqueueJob("kyc.score-case", { caseId }, { maxAttempts: 3 });
```

Jobs are persisted, retried with backoff, visible in **System → Jobs**, and emit `job.completed` /
`job.failed`. A common pattern (used by the Playground) is to `subscribe("kyc.case.created", ...)`
and enqueue the scoring job from there.

## 10. Notifications

```ts
await notifyUsers([userId], { title: "Case assigned", body: "...", href: `/kyc/${id}` });
await notifyPermissionHolders("kyc.case.decide", { title: "New case awaiting review", href: "/kyc" });
```

They appear in the bell menu instantly (pushed over the event stream).

## 11. UI kit cheatsheet (`@/kernel/ui`)

`PageHeader`, `Card/CardHeader/CardBody`, `Stat`, `Badge` + `statusTone()`, `Alert`, `EmptyState`,
`DataTable` + `Pagination` + `tableParams()`, `SearchBox`, `Dialog`, `ActionForm`, `Field`,
`Input/Textarea/Select/Checkbox`, `SubmitButton`, `InlineAction`, `CopyButton`, `RelativeTime`,
`JsonView`, `Icon`, `LiveRefresh`.

## Checklist for a new app

- [ ] Manifest declares every permission and event the app uses
- [ ] Every page calls `pageContext(...)`; every action calls `requirePermission(...)`
- [ ] Every write calls `ctx.audit(...)` and `publish(...)`
- [ ] Long-running / ML work goes through `enqueueJob`
- [ ] Sensitive decisions go through `requestApproval`
- [ ] Seed data added to `prisma/seed.ts`; `npm run lint && npm run typecheck && npm run test` green
