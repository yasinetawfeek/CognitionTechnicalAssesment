/**
 * Demo seed. Idempotent — safe to re-run. All demo passwords are `password123`.
 *
 *   admin@demo.local       Admin              (*)
 *   reviewer@demo.local    Reviewer           (playground.*, approvals, audit read)
 *   maker@demo.local       Engineer           (playground create/submit, system read)
 *   viewer@demo.local      Viewer             (read-only)
 *   controller@demo.local  Finance controller (owns deadlines, sees every deadline)
 *   analyst@demo.local     Finance analyst    (only deadlines shared with the role or with them)
 *   counsel@demo.local     Legal counsel      (board / legal deadlines)
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
    permissions: ["playground.*", "approvals.access", "audit.access", "kernel.audit.read", "kernel.approvals.read", "system.access", "kernel.events.read", "kernel.flags.read", "kernel.jobs.read"],
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
  {
    key: "finance_controller",
    name: "Finance controller",
    description: "Owns the financial calendar: creates deadlines and sees every one of them",
    permissions: [
      "deadlines.access",
      "deadlines.deadline.create",
      "deadlines.deadline.manage",
      "deadlines.deadline.complete",
      "deadlines.deadline.viewall",
      "deadlines.reminder.run",
      "approvals.access",
    ],
  },
  {
    key: "finance_analyst",
    name: "Finance analyst",
    description: "Works the deadlines shared with the finance team",
    permissions: ["deadlines.access", "deadlines.deadline.complete"],
  },
  {
    key: "legal_counsel",
    name: "Legal counsel",
    description: "Sees board and legal deadlines shared with the role",
    permissions: ["deadlines.access", "deadlines.deadline.complete"],
  },
];

const users: { email: string; name: string; roles: string[] }[] = [
  { email: "admin@demo.local", name: "Ada Admin", roles: ["admin"] },
  { email: "reviewer@demo.local", name: "Rita Reviewer", roles: ["reviewer"] },
  { email: "maker@demo.local", name: "Max Maker", roles: ["engineer"] },
  { email: "viewer@demo.local", name: "Vic Viewer", roles: ["viewer", "finance_analyst"] },
  { email: "controller@demo.local", name: "Cora Controller", roles: ["finance_controller"] },
  { email: "analyst@demo.local", name: "Alan Analyst", roles: ["finance_analyst"] },
  { email: "counsel@demo.local", name: "Lena Counsel", roles: ["legal_counsel"] },
];

const flags = [
  { key: "playground.beta-panel", description: "Shows the flag-gated card in the Playground app", enabled: true, ownerAppId: "playground", rules: { roles: ["admin", "engineer"] } },
  { key: "playground.advanced-scoring", description: "Show numeric risk scores instead of normal/outlier badges", enabled: false, ownerAppId: "playground", rules: null },
  { key: "kernel.command-palette", description: "Example kernel-owned flag (no effect yet)", enabled: true, ownerAppId: "kernel", rules: { percentage: 100 } },
];

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number, hour = 17) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/**
 * Mock financial calendar covering all three visibility modes:
 * everyone with app access, a set of roles, and named individuals.
 */
const deadlines: {
  reference: string;
  title: string;
  description: string;
  category: string;
  entity: string;
  dueInDays: number;
  owner: string;
  visibility: "EVERYONE" | "ROLES" | "USERS";
  roles?: string[];
  people?: string[];
  status?: "OPEN" | "COMPLETED";
}[] = [
  {
    reference: "FD-2026-001",
    title: "Q1 VAT return filing",
    description: "Submit the quarterly VAT return to HMRC and settle the balance.",
    category: "TAX",
    entity: "Acme Payments Ltd",
    dueInDays: 0.5,
    owner: "controller@demo.local",
    visibility: "EVERYONE",
  },
  {
    reference: "FD-2026-002",
    title: "FCA client money reconciliation sign-off",
    description: "Daily CASS reconciliation must be signed off by the controller.",
    category: "REGULATORY",
    entity: "Acme Payments Ltd",
    dueInDays: 5,
    owner: "controller@demo.local",
    visibility: "ROLES",
    roles: ["finance_controller", "finance_analyst"],
  },
  {
    reference: "FD-2026-003",
    title: "Board pack distribution",
    description: "Circulate the board pack 5 working days before the meeting.",
    category: "BOARD",
    entity: "Group",
    dueInDays: 12,
    owner: "counsel@demo.local",
    visibility: "ROLES",
    roles: ["legal_counsel", "finance_controller"],
  },
  {
    reference: "FD-2026-004",
    title: "External audit — revenue sampling walkthrough",
    description: "Provide the auditors with the revenue sample and walkthrough notes.",
    category: "AUDIT",
    entity: "Acme Payments Ltd",
    dueInDays: 3,
    owner: "analyst@demo.local",
    visibility: "USERS",
    people: ["analyst@demo.local", "controller@demo.local"],
  },
  {
    reference: "FD-2026-005",
    title: "Corporation tax instalment",
    description: "Second quarterly instalment payment for the current period.",
    category: "TAX",
    entity: "Acme Holdings",
    dueInDays: -2,
    owner: "controller@demo.local",
    visibility: "EVERYONE",
  },
  {
    reference: "FD-2026-006",
    title: "Client fee schedule review",
    description: "Annual review of the tiered fee schedule with the largest client.",
    category: "CLIENT",
    entity: "Northwind Bank",
    dueInDays: 25,
    owner: "analyst@demo.local",
    visibility: "ROLES",
    roles: ["finance_analyst"],
  },
  {
    reference: "FD-2026-007",
    title: "Month-end close checklist",
    description: "Close the ledger, post accruals, and hand over to reporting.",
    category: "INTERNAL",
    entity: "Group",
    dueInDays: -9,
    owner: "controller@demo.local",
    visibility: "EVERYONE",
    status: "COMPLETED",
  },
];

async function seedDeadlines() {
  if ((await db.financeDeadline.count()) > 0) return;
  const userIds = new Map((await db.user.findMany({ select: { id: true, email: true } })).map((u) => [u.email, u.id]));
  const idOf = (email: string) => userIds.get(email)!;
  const pipe = (values: string[]) => (values.length ? `|${values.join("|")}|` : "");

  for (const d of deadlines) {
    const created = await db.financeDeadline.create({
      data: {
        reference: d.reference,
        title: d.title,
        description: d.description,
        category: d.category,
        entity: d.entity,
        dueAt: inDays(d.dueInDays),
        status: d.status ?? "OPEN",
        completedAt: d.status === "COMPLETED" ? inDays(d.dueInDays - 1) : null,
        completedById: d.status === "COMPLETED" ? idOf(d.owner) : null,
        ownerId: idOf(d.owner),
        createdById: idOf("controller@demo.local"),
        visibility: d.visibility,
        visibleRoles: d.visibility === "ROLES" ? pipe(d.roles ?? []) : "",
        visibleUsers: d.visibility === "USERS" ? pipe((d.people ?? []).map(idOf)) : "",
      },
    });
    await publish({
      type: "deadlines.deadline.created",
      sourceAppId: "deadlines",
      actorId: idOf("controller@demo.local"),
      payload: { deadlineId: created.id, reference: created.reference, dueAt: created.dueAt.toISOString() },
    });
  }

  // The reminder job picks these up on its next tick and notifies each deadline's audience.
  await db.job.create({ data: { type: "deadlines.scan-reminders", payload: { trigger: "seed" }, maxAttempts: 1 } });
  console.log(`Seeded ${deadlines.length} financial deadlines`);
}

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

  await seedDeadlines();

  console.log(`Seeded ${roles.length} roles, ${users.length} users, ${flags.length} flags. Password for all demo users: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
