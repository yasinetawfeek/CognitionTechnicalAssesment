# Internal Tools Kernel (PoC)

A proof-of-concept **internal tool platform** intended to replace a Power Apps estate
(KYC review queue, refunds dashboard, feature-flag admin) for a ~60-engineer fintech.

This repo contains the **kernel** only: the shared runtime every internal app is built on.
The first business apps (KYC review queue, feature-flag admin panel) come next, as
thin apps on top of these primitives.

## What the kernel provides

| Capability | Where | Notes |
| --- | --- | --- |
| Session auth | `src/kernel/auth` | bcrypt password login, DB-backed sessions (hashed tokens, 12h TTL, sliding refresh), `httpOnly` cookie |
| OIDC adapter | `src/kernel/auth/oidc.ts` | Discovery + auth-code flow, JIT provisioning, group→role mapping. Enabled by env vars, no code change |
| RBAC | `src/kernel/rbac` | Users, roles, `app.resource.action` permissions with wildcards (`kyc.*`), per-app `<app>.access` |
| Audit log | `src/kernel/audit` | Hash-chained (SHA-256), tamper-evident, verifiable from the UI (`/audit/verify`) |
| Event bus | `src/kernel/events` | Persisted events, in-process subscribers, **SSE push to browsers**, outbound webhooks (HMAC-signed) |
| Feature flags | `src/kernel/flags` + `/flags` UI | Part of the kernel (not an app). Global / user / role / percentage rollout; server `isEnabled()` + client `useFlag()`; live invalidation via events |
| Approvals | `src/kernel/approvals` | Four-eyes / maker-checker primitive; apps register a handler that runs on approval |
| Background jobs | `src/kernel/jobs` | DB-backed queue with retries; the extension point for ML scoring (e.g. KYC outlier detection) |
| Notifications | `src/kernel/notifications` | Per-user inbox, pushed live over the event stream |
| App registry | `src/kernel/apps` | Apps are manifests (`defineApp`) declaring permissions, events, nav; auto-discovered in the shell |
| UI kit | `src/kernel/ui` | Page/Card/DataTable/Dialog/Forms/`ActionForm`/`LiveRefresh`… so apps look and behave the same |
| Server actions | `src/kernel/actions.ts` | `action()` wrapper: zod form parsing, kernel error → UI error mapping |

Built-in apps (all written on the kernel, as any future app will be):

- **Playground** (`/playground`) – reference app: records with create → approve (four-eyes) → demo "ML" scoring job, flag-gated UI, live updates.
- **Approvals** (`/approvals`) – cross-app maker-checker inbox.
- **Admin** (`/admin`) – users, roles, permission catalogue.
- **Audit** (`/audit`) – search + chain verification.
- **Feature Flags** (`/flags`) – platform-wide flag control surface: grouped by owning app, targeting rules, change history.
- **App Builder** (`/builder`) – self-serve app requests: describe an app → an AI coding agent builds it on a branch (live build log) → requester tests the preview → admin reviews via four-eyes → published. The agent/VCS integration is an adapter (`src/kernel/appbuilder`); the PoC ships a mock Devin adapter, a real one would call the Devin API and merge the PR via GitHub on approval.
- **System** (`/system`) – events, jobs, webhooks, app registry.

## Quick start

```bash
cp .env.example .env
npm run setup        # npm install + prisma generate + db push + seed
npm run dev          # http://localhost:3000
```

Demo users (password `password123`):

| Email | Role | Can |
| --- | --- | --- |
| `admin@demo.local` | Admin (`*`) | everything |
| `reviewer@demo.local` | Reviewer | approve Playground records, read audit/system |
| `maker@demo.local` | Engineer | create/submit records, manage flags & jobs |
| `viewer@demo.local` | Viewer | read-only |

Try the golden path: log in as **maker**, create a record and submit it; in another browser log in as
**reviewer** and approve it from `/approvals` – the maker's page updates live and the job worker
scores the record. Toggle `playground.beta-panel` on `/flags` and watch the Playground page
react without a reload.

## Scripts

```bash
npm run dev / build / start
npm run lint && npm run typecheck && npm run test
npm run db:reset                 # wipe SQLite + reseed
npm run create-app -- kyc "KYC Review" --icon UserCheck --category operations
```

## Building an app

See [`docs/APP_AUTHORING.md`](docs/APP_AUTHORING.md) (and `AGENTS.md` for the short version
aimed at Devin/engineers). The scaffold generates a manifest, server actions, a page and
routes, and registers the app; from there an app is ordinary Next.js + kernel calls:

```ts
const ctx = await requirePermission("kyc.case.decide");   // session + RBAC (throws Forbidden)
await ctx.audit({ appId: "kyc", action: "case.decide", targetType: "KycCase", targetId: caseId });
await publish({ type: "kyc.case.decided", sourceAppId: "kyc", actorId: ctx.user.id, payload: { caseId } });
```

## Cross-app propagation & ML hooks

- Every write publishes an event; browsers subscribe over one shared SSE stream, so a flag flipped in
  the (future) feature-flag admin app updates every open app instantly (`useFlag`, `LiveRefresh`).
- Heavy/async work goes through `enqueueJob`/`registerJobHandler`. The Playground's
  `playground.score-record` job is the pattern for a KYC outlier-detection job calling an ML service.

## PoC limitations (deliberate)

- SQLite + single Node process (job worker, SSE fan-out, event subscribers are in-process).
  Swap `DATABASE_URL` to Postgres and move the worker/SSE to Redis pub/sub for multi-instance.
- OIDC: ID token signature is not fully verified against JWKS; `userinfo` is used as the source of truth.
- No rate limiting, CSRF is delegated to Next.js server-action origin checks, no MFA.
- App Builder uses a mock agent adapter: the build log, PR link and preview are simulated (no Devin/GitHub calls). Wire `getAppBuilderAdapter()` to the Devin API + GitHub to make it real.
- Tests cover kernel logic (RBAC, audit chain, events, flags, actions, auth helpers), not UI.
