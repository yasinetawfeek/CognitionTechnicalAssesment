/**
 * Demo seed. Idempotent — safe to re-run. All demo passwords are `password123`.
 *
 *   admin@demo.local       Admin            (*)
 *   reviewer@demo.local    Reviewer         (playground.*, kyc review/decide, approvals, audit read)
 *   compliance@demo.local  Compliance lead  (kyc.* incl. supervise — signs off high-risk approvals)
 *   maker@demo.local       Engineer         (playground create/submit, kyc create, system read)
 *   viewer@demo.local      Viewer           (read-only)
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
];

const users: { email: string; name: string; roles: string[] }[] = [
  { email: "admin@demo.local", name: "Ada Admin", roles: ["admin"] },
  { email: "reviewer@demo.local", name: "Rita Reviewer", roles: ["reviewer"] },
  { email: "compliance@demo.local", name: "Cal Compliance", roles: ["compliance-lead"] },
  { email: "maker@demo.local", name: "Max Maker", roles: ["engineer"] },
  { email: "viewer@demo.local", name: "Vic Viewer", roles: ["viewer"] },
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

  console.log(`Seeded ${roles.length} roles, ${users.length} users, ${flags.length} flags. Password for all demo users: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
