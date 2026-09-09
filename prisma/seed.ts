/**
 * Demo seed. Idempotent — safe to re-run. All demo passwords are `password123`.
 *
 *   admin@demo.local       Admin              (*)
 *   reviewer@demo.local    Reviewer           (playground.*, kyc review/decide, approvals, audit read)
 *   compliance@demo.local  Compliance lead    (kyc.* incl. supervise — signs off high-risk approvals)
 *   maker@demo.local       Engineer           (playground create/submit, kyc create, system read)
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
    permissions: [
      "playground.*",
      "kyc.access",
      "kyc.case.read",
      "kyc.case.assign",
      "kyc.case.note",
      "kyc.case.decide",
      "approvals.access",
      "audit.access",
      "kernel.audit.read",
      "kernel.approvals.read",
      "flags.access",
      "builder.access",
      "builder.request.review",
      "system.access",
      "kernel.events.read",
      "kernel.flags.read",
      "kernel.jobs.read",
    ],
  },
  {
    key: "compliance-lead",
    name: "Compliance lead",
    description: "Supervises KYC: resolves escalations and signs off high-risk approvals (four-eyes)",
    permissions: ["kyc.*", "approvals.access", "kernel.approvals.read", "audit.access", "kernel.audit.read"],
  },
  {
    key: "engineer",
    name: "Engineer",
    description: "Builds and operates apps; can create and submit but not approve",
    permissions: [
      "playground.access",
      "playground.record.create",
      "playground.record.submit",
      "kyc.access",
      "kyc.case.read",
      "kyc.case.create",
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
  { key: "viewer", name: "Viewer", description: "Read-only access to the playground and audit log", permissions: ["playground.access", "kyc.access", "kyc.case.read", "audit.access", "kernel.audit.read"] },
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
  { email: "compliance@demo.local", name: "Cal Compliance", roles: ["compliance-lead"] },
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
  { key: "kyc.auto-approve-low-risk", description: "Scoring job auto-approves LOW-risk KYC cases without a reviewer", enabled: false, ownerAppId: "kyc", rules: null },
  { key: "kyc.risk-breakdown", description: "Show the per-factor risk breakdown on KYC case pages", enabled: true, ownerAppId: "kyc", rules: null },
];

const kycSamples: {
  applicantName: string;
  email: string;
  country: string;
  dateOfBirth: string;
  documentType: string;
  documentNumber: string;
  declaredIncome: number;
  initialDeposit: number;
  pepMatch?: boolean;
  sanctionsHit?: boolean;
}[] = [
  { applicantName: "Olivia Bennett", email: "olivia.bennett@example.com", country: "GB", dateOfBirth: "1988-04-12", documentType: "PASSPORT", documentNumber: "GB5512345", declaredIncome: 52000, initialDeposit: 1500 },
  { applicantName: "Liam Carter", email: "liam.carter@example.com", country: "GB", dateOfBirth: "1994-09-30", documentType: "DRIVING_LICENCE", documentNumber: "CARTE909304LC9AB", declaredIncome: 34000, initialDeposit: 800 },
  { applicantName: "Sophie Müller", email: "sophie.mueller@example.de", country: "DE", dateOfBirth: "1979-01-22", documentType: "NATIONAL_ID", documentNumber: "L01X00T47", declaredIncome: 71000, initialDeposit: 3200 },
  { applicantName: "Noah Fischer", email: "noah.fischer@example.de", country: "DE", dateOfBirth: "2006-11-02", documentType: "NATIONAL_ID", documentNumber: "T22000129", declaredIncome: 12000, initialDeposit: 900 },
  { applicantName: "Amara Okafor", email: "amara.okafor@example.com", country: "NG", dateOfBirth: "1985-06-17", documentType: "PASSPORT", documentNumber: "A50123456", declaredIncome: 28000, initialDeposit: 26000 },
  { applicantName: "Mateo Álvarez", email: "mateo.alvarez@example.es", country: "ES", dateOfBirth: "1990-03-08", documentType: "PASSPORT", documentNumber: "XDA123456", declaredIncome: 45000, initialDeposit: 2000 },
  { applicantName: "Elena Petrova", email: "elena.petrova@example.com", country: "RU", dateOfBirth: "1982-12-01", documentType: "PASSPORT", documentNumber: "72 1234567", declaredIncome: 60000, initialDeposit: 55000, pepMatch: true },
  { applicantName: "Hassan Karimi", email: "hassan.karimi@example.com", country: "IR", dateOfBirth: "1975-07-19", documentType: "PASSPORT", documentNumber: "K12345678", declaredIncome: 40000, initialDeposit: 120000, sanctionsHit: true },
  { applicantName: "Grace Whitfield", email: "grace.whitfield@example.com", country: "US", dateOfBirth: "1969-10-25", documentType: "DRIVING_LICENCE", documentNumber: "W123-4567-8901", declaredIncome: 95000, initialDeposit: 4000 },
  { applicantName: "Kenji Tanaka", email: "kenji.tanaka@example.jp", country: "JP", dateOfBirth: "1998-02-14", documentType: "PASSPORT", documentNumber: "TK1234567", declaredIncome: 38000, initialDeposit: 1200 },
  { applicantName: "Isabela Costa", email: "isabela.costa@example.br", country: "BR", dateOfBirth: "1991-08-03", documentType: "NATIONAL_ID", documentNumber: "12.345.678-9", declaredIncome: 22000, initialDeposit: 14000 },
  { applicantName: "Daniel Osei", email: "daniel.osei@example.com", country: "PA", dateOfBirth: "1987-05-29", documentType: "PASSPORT", documentNumber: "PA0987654", declaredIncome: 30000, initialDeposit: 2500 },
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

  if ((await db.kycCase.count()) === 0) {
    let i = 0;
    for (const s of kycSamples) {
      i += 1;
      const submittedAt = new Date(Date.now() - (kycSamples.length - i) * 6 * 60 * 60 * 1000);
      const kycCase = await db.kycCase.create({
        data: {
          reference: `KYC-${String(i).padStart(4, "0")}`,
          applicantName: s.applicantName,
          email: s.email,
          country: s.country,
          dateOfBirth: new Date(s.dateOfBirth),
          documentType: s.documentType,
          documentNumber: s.documentNumber,
          declaredIncome: s.declaredIncome,
          initialDeposit: s.initialDeposit,
          pepMatch: s.pepMatch ?? false,
          sanctionsHit: s.sanctionsHit ?? false,
          submittedAt,
          createdAt: submittedAt,
        },
      });
      await recordAudit(SYSTEM_ACTOR, { appId: "kyc", action: "case.create", targetType: "KycCase", targetId: kycCase.id, after: { reference: kycCase.reference, country: s.country }, metadata: { seed: true } });
      await publish({ type: "kyc.case.created", sourceAppId: "kyc", actorId: null, payload: { caseId: kycCase.id, reference: kycCase.reference } });
      await db.job.create({ data: { type: "kyc.score-case", payload: { caseId: kycCase.id } } });
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
