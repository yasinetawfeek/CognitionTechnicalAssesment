/**
 * Demo seed. Idempotent — safe to re-run. All demo passwords are `password123`.
 *
 *   admin@demo.local     Admin      (*)
 *   reviewer@demo.local  Reviewer   (playground.*, approvals, audit read)
 *   maker@demo.local     Engineer   (playground create/submit, system read)
 *   viewer@demo.local    Viewer     (read-only)
 */
import { db } from "../src/kernel/db";
import { hashPassword } from "../src/kernel/auth/password";
import { recordAudit } from "../src/kernel/audit";
import { publish } from "../src/kernel/events/bus";
import { SYSTEM_ACTOR } from "../src/kernel/context";

const PASSWORD = "password123";

const roles: { key: string; name: string; description: string; isSystem?: boolean; permissions: string[] }[] = [
  { key: "admin", name: "Admin", description: "Full access to everything, including user and role management", isSystem: true, permissions: ["*"] },
  {
    key: "reviewer",
    name: "Reviewer",
    description: "Second pair of eyes: approves submitted work, reads the audit log",
    permissions: ["playground.*", "approvals.access", "audit.access", "kernel.audit.read", "kernel.approvals.read", "flags.access", "builder.access", "builder.request.review", "system.access", "kernel.events.read", "kernel.flags.read", "kernel.jobs.read"],
  },
  {
    key: "engineer",
    name: "Engineer",
    description: "Builds and operates apps; can create and submit but not approve",
    permissions: [
      "playground.access",
      "playground.record.create",
      "playground.record.submit",
      "approvals.access",
      "builder.access",
      "builder.request.create",
      "flags.access",
      "system.access",
      "kernel.events.read",
      "kernel.flags.read",
      "kernel.flags.manage",
      "kernel.jobs.read",
      "kernel.jobs.manage",
      "kernel.webhooks.manage",
    ],
  },
  { key: "viewer", name: "Viewer", description: "Read-only access to the playground and audit log", permissions: ["playground.access", "audit.access", "kernel.audit.read"] },
];

const users: { email: string; name: string; roles: string[] }[] = [
  { email: "admin@demo.local", name: "Ada Admin", roles: ["admin"] },
  { email: "reviewer@demo.local", name: "Rita Reviewer", roles: ["reviewer"] },
  { email: "maker@demo.local", name: "Max Maker", roles: ["engineer"] },
  { email: "viewer@demo.local", name: "Vic Viewer", roles: ["viewer"] },
];

const flags = [
  { key: "playground.beta-panel", description: "Shows the flag-gated card in the Playground app", enabled: true, ownerAppId: "playground", rules: { roles: ["admin", "engineer"] } },
  { key: "playground.advanced-scoring", description: "Show numeric risk scores instead of normal/outlier badges", enabled: false, ownerAppId: "playground", rules: null },
  { key: "kernel.command-palette", description: "Example kernel-owned flag (no effect yet)", enabled: true, ownerAppId: "kernel", rules: { percentage: 100 } },
];

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const roleIds = new Map<string, string>();
  for (const r of roles) {
    const role = await db.role.upsert({
      where: { key: r.key },
      create: { key: r.key, name: r.name, description: r.description, isSystem: r.isSystem ?? false, permissions: { create: r.permissions.map((permission) => ({ permission })) } },
      update: { name: r.name, description: r.description, permissions: { deleteMany: {}, create: r.permissions.map((permission) => ({ permission })) } },
    });
    roleIds.set(r.key, role.id);
  }

  for (const u of users) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    const user =
      existing ??
      (await db.user.create({ data: { email: u.email, name: u.name, passwordHash } }));
    await db.userRole.deleteMany({ where: { userId: user.id } });
    await db.userRole.createMany({ data: u.roles.map((k) => ({ userId: user.id, roleId: roleIds.get(k)! })) });
    if (!existing) {
      await recordAudit(SYSTEM_ACTOR, { appId: "kernel", action: "user.create", targetType: "User", targetId: user.id, after: { email: u.email, roles: u.roles }, metadata: { seed: true } });
      await publish({ type: "kernel.user.created", sourceAppId: "kernel", actorId: null, payload: { id: user.id, email: u.email } });
    }
  }

  for (const f of flags) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      create: { key: f.key, description: f.description, enabled: f.enabled, ownerAppId: f.ownerAppId, rules: f.rules ?? undefined },
      update: { description: f.description },
    });
  }

  const maker = await db.user.findUniqueOrThrow({ where: { email: "maker@demo.local" } });
  if ((await db.playgroundRecord.count()) === 0) {
    const samples = [
      { title: "Refund — order #1042", amount: 89.5 },
      { title: "Refund — order #1043", amount: 120 },
      { title: "Refund — order #1044", amount: 74.99 },
      { title: "Refund — order #1045", amount: 4999 },
    ];
    for (const s of samples) {
      const rec = await db.playgroundRecord.create({ data: { ...s, createdById: maker.id } });
      await publish({ type: "playground.record.created", sourceAppId: "playground", actorId: maker.id, payload: { recordId: rec.id, ...s } });
      await db.job.create({ data: { type: "playground.score-record", payload: { recordId: rec.id } } });
    }
  }

  if ((await db.appRequest.count()) === 0) {
    const now = new Date();
    const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60_000).toISOString();
    await db.appRequest.create({
      data: {
        appId: "playground",
        name: "Playground",
        purpose: "Reference app that exercises every kernel primitive so engineers have a worked example to copy.",
        requirements: "- Records table with create / submit / approve (four-eyes)\n- Demo ML scoring job with outlier badge\n- Flag-gated beta panel that updates live",
        status: "PUBLISHED",
        requestedById: maker.id,
        sessionId: "devin-mock-seed0001",
        sessionUrl: "https://app.devin.ai/sessions/devin-mock-seed0001",
        branch: "apps/playground",
        prUrl: "https://github.com/example/internal-tools/pull/101",
        previewUrl: null,
        reviewNote: "Looks good — matches the authoring guide.",
        publishedAt: new Date(now.getTime() - 60 * 60_000),
        buildLog: [
          { at: at(75), step: "Session started (Mock Devin (PoC))" },
          { at: at(74), step: "Reading AGENTS.md and docs/APP_AUTHORING.md" },
          { at: at(72), step: "Scaffolding app", detail: 'npm run create-app -- playground "Playground"' },
          { at: at(68), step: "Implementing pages, actions and server hooks", detail: "src/apps/playground/*" },
          { at: at(65), step: "Running lint, typecheck and tests", detail: "all green" },
          { at: at(64), step: "Opening pull request" },
        ],
      },
    });
  }

  console.log(`Seeded ${roles.length} roles, ${users.length} users, ${flags.length} flags. Password for all demo users: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
