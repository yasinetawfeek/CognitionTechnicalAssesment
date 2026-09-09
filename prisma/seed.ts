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
import { scoreCase } from "../src/apps/kyc/scoring";
import type { Prisma } from "@prisma/client";

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
  { email: "jordan.lee@demo.local", name: "Jordan Lee", roles: ["engineer"] },
  { email: "priya.shah@demo.local", name: "Priya Shah", roles: ["reviewer"] },
  { email: "marcus.reid@demo.local", name: "Marcus Reid", roles: ["compliance-lead"] },
  { email: "sofia.romano@demo.local", name: "Sofia Romano", roles: ["finance_analyst", "viewer"] },
  { email: "dev.patel@demo.local", name: "Dev Patel", roles: ["viewer"] },
];

const flags = [
  { key: "playground.beta-panel", description: "Shows the flag-gated card in the Playground app", enabled: true, ownerAppId: "playground", rules: { roles: ["admin", "engineer"] } },
  { key: "playground.advanced-scoring", description: "Show numeric risk scores instead of normal/outlier badges", enabled: false, ownerAppId: "playground", rules: null },
  { key: "kernel.command-palette", description: "Example kernel-owned flag (no effect yet)", enabled: true, ownerAppId: "kernel", rules: { percentage: 100 } },
  { key: "kyc.auto-approve-low-risk", description: "Scoring job auto-approves LOW-risk KYC cases without a reviewer", enabled: false, ownerAppId: "kyc", rules: null },
  { key: "kyc.risk-breakdown", description: "Show the per-factor risk breakdown on KYC case pages", enabled: true, ownerAppId: "kyc", rules: null },
  { key: "kyc.new-queue-layout", description: "Gradual rollout of the redesigned KYC queue (25% of users)", enabled: true, ownerAppId: "kyc", rules: { percentage: 25 } },
  { key: "deadlines.slack-digest", description: "Post a daily digest of upcoming deadlines to Slack (not wired yet)", enabled: false, ownerAppId: "deadlines", rules: null },
  { key: "kernel.oidc-login", description: "Show the 'Sign in with SSO' button on the login page", enabled: false, ownerAppId: "kernel", rules: { roles: ["admin"] } },
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

/** Default "My apps" per demo user (installing is per-user; RBAC still gates access). Idempotent. */
const installs: Record<string, string[]> = {
  "admin@demo.local": ["kyc", "deadlines", "playground"],
  "reviewer@demo.local": ["kyc"],
  "compliance@demo.local": ["kyc"],
  "priya.shah@demo.local": ["kyc"],
  "marcus.reid@demo.local": ["kyc"],
  "controller@demo.local": ["deadlines"],
  "analyst@demo.local": ["deadlines"],
  "counsel@demo.local": ["deadlines"],
  "maker@demo.local": ["playground"],
};

async function seedAppInstalls() {
  const byEmail = new Map((await db.user.findMany()).map((u) => [u.email, u.id]));
  for (const [email, appIds] of Object.entries(installs)) {
    const userId = byEmail.get(email);
    if (!userId) continue;
    for (const appId of appIds) {
      await db.appInstall.upsert({ where: { userId_appId: { userId, appId } }, create: { userId, appId }, update: {} });
    }
  }
}

/**
 * Demo history: pre-scored and pre-decided KYC cases with notes, open and decided approvals,
 * several App Builder requests in flight, a webhook subscription, flag changes in the audit
 * log and a few notifications — so every screen has something on it on first launch.
 */
async function seedDemoHistory() {
  if ((await db.approvalRequest.count()) > 0) return;

  const byEmail = new Map((await db.user.findMany()).map((u) => [u.email, u]));
  const u = (email: string) => byEmail.get(email)!;
  const actor = (email: string) => ({ id: u(email).id, email });
  const admin = u("admin@demo.local");
  const reviewer = u("reviewer@demo.local");
  const priya = u("priya.shah@demo.local");
  const compliance = u("compliance@demo.local");
  const maker = u("maker@demo.local");
  const jordan = u("jordan.lee@demo.local");
  const HOUR = 60 * 60 * 1000;
  const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

  // --- KYC: score everything now (the job re-scores identically later) and work part of the queue.
  const cases = await db.kycCase.findMany({ orderBy: { reference: "asc" } });
  const deposits = cases.map((c) => c.initialDeposit);
  for (const c of cases) {
    const r = scoreCase(c, deposits.filter((d) => d !== c.initialDeposit));
    await db.kycCase.update({
      where: { id: c.id },
      data: { riskScore: r.score, riskLevel: r.level, riskFactors: r.factors as unknown as Prisma.InputJsonValue, scoredAt: c.submittedAt },
    });
  }
  const byRef = new Map((await db.kycCase.findMany()).map((c) => [c.reference, c]));
  const kyc = (ref: string) => byRef.get(ref)!;

  const note = async (ref: string, who: string, body: string, hoursAgo: number) => {
    const c = kyc(ref);
    const n = await db.kycCaseNote.create({ data: { caseId: c.id, authorId: u(who).id, body, createdAt: ago(hoursAgo) } });
    await recordAudit(actor(who), { appId: "kyc", action: "case.note", targetType: "KycCase", targetId: c.id, after: { noteId: n.id, body }, metadata: { reference: ref } });
  };
  const decide = async (ref: string, who: string, decision: "APPROVE" | "REJECT", body: string, hoursAgo: number) => {
    const c = kyc(ref);
    const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await db.kycCase.update({ where: { id: c.id }, data: { status, decision, decisionNote: body, decidedById: u(who).id, decidedAt: ago(hoursAgo), assignedToId: u(who).id } });
    await recordAudit(actor(who), { appId: "kyc", action: decision === "APPROVE" ? "case.approve" : "case.reject", targetType: "KycCase", targetId: c.id, before: { status: "IN_REVIEW" }, after: { status, decision, note: body }, metadata: { reference: ref, via: "reviewer", riskLevel: c.riskLevel } });
    await publish({ type: "kyc.case.decided", sourceAppId: "kyc", actorId: u(who).id, payload: { caseId: c.id, reference: ref, decision, riskLevel: c.riskLevel, via: "reviewer" } });
  };
  const claim = async (ref: string, who: string, hoursAgo: number) => {
    const c = kyc(ref);
    await db.kycCase.update({ where: { id: c.id }, data: { status: "IN_REVIEW", assignedToId: u(who).id } });
    await recordAudit(actor(who), { appId: "kyc", action: "case.claim", targetType: "KycCase", targetId: c.id, before: { status: "NEW" }, after: { status: "IN_REVIEW", assignedToId: u(who).id }, metadata: { reference: ref, at: ago(hoursAgo).toISOString() } });
  };

  await claim("KYC-0001", "reviewer@demo.local", 40);
  await note("KYC-0001", "reviewer@demo.local", "Passport verified against the document image. Address matches the utility bill on file.", 39);
  await decide("KYC-0001", "reviewer@demo.local", "APPROVE", "Low risk, documents consistent. Approved.", 38);

  await claim("KYC-0002", "priya.shah@demo.local", 36);
  await decide("KYC-0002", "priya.shah@demo.local", "APPROVE", "Standard retail onboarding, no flags.", 35);

  await claim("KYC-0004", "priya.shah@demo.local", 30);
  await note("KYC-0004", "priya.shah@demo.local", "Applicant is 19 with a declared income of 12k and a 900 deposit — plausible for a student account, but the ID scan is blurry.", 29);
  await note("KYC-0004", "priya.shah@demo.local", "Requested a re-upload of the national ID. No response after 48h.", 20);
  await decide("KYC-0004", "priya.shah@demo.local", "REJECT", "Unable to verify identity document; applicant did not respond to re-upload request.", 12);

  await claim("KYC-0005", "reviewer@demo.local", 8);
  await note("KYC-0005", "reviewer@demo.local", "Initial deposit (26k) is ~93% of declared annual income. Asked for source-of-funds evidence.", 7);

  await claim("KYC-0009", "reviewer@demo.local", 3);

  // High-risk PEP match: reviewer proposes approval, waiting on a compliance supervisor (four-eyes).
  const pep = kyc("KYC-0007");
  const pepApproval = await db.approvalRequest.create({
    data: {
      appId: "kyc",
      type: "kyc.case.approve",
      title: `Approve ${pep.reference} — ${pep.applicantName} (HIGH risk, PEP match)`,
      description: "Reviewer recommends approval with enhanced due diligence. Requires kyc.case.supervise sign-off.",
      payload: { caseId: pep.id, reference: pep.reference, applicantName: pep.applicantName, riskScore: pep.riskScore, riskLevel: pep.riskLevel, note: "EDD completed: PEP status is a regional council role, source of wealth documented (property sale). Recommend approve with annual review." },
      requiredPermission: "kyc.case.supervise",
      requestedById: reviewer.id,
      createdAt: ago(5),
    },
  });
  await db.kycCase.update({ where: { id: pep.id }, data: { status: "PENDING_APPROVAL", assignedToId: reviewer.id, approvalRequestId: pepApproval.id } });
  await note("KYC-0007", "reviewer@demo.local", "PEP match confirmed (regional council member). Enhanced due diligence file attached; source of wealth is a documented property sale.", 6);
  await recordAudit(actor("reviewer@demo.local"), { appId: "kyc", action: "approval.request", targetType: "ApprovalRequest", targetId: pepApproval.id, after: { type: "kyc.case.approve", title: pepApproval.title, requiredPermission: "kyc.case.supervise" } });
  await publish({ type: "approval.requested", sourceAppId: "kyc", actorId: reviewer.id, payload: { id: pepApproval.id, type: "kyc.case.approve", title: pepApproval.title, requiredPermission: "kyc.case.supervise" } });
  await db.notification.createMany({
    data: [compliance, u("marcus.reid@demo.local"), admin].map((usr) => ({ userId: usr.id, title: `Approval needed: ${pepApproval.title}`, body: `Requested by ${reviewer.name}`, href: `/approvals/${pepApproval.id}`, appId: "kyc", createdAt: ago(5) })),
  });

  // Sanctions hit: escalated straight to compliance.
  const sanc = kyc("KYC-0008");
  await db.kycCase.update({ where: { id: sanc.id }, data: { status: "ESCALATED", assignedToId: null } });
  await note("KYC-0008", "priya.shah@demo.local", "Sanctions screening returned a hit against the OFAC SDN list (name + DOB). Escalating to compliance — do not approve.", 4);
  await recordAudit(actor("priya.shah@demo.local"), { appId: "kyc", action: "case.escalate", targetType: "KycCase", targetId: sanc.id, before: { status: "IN_REVIEW" }, after: { status: "ESCALATED" }, metadata: { reference: sanc.reference, reason: "Sanctions hit" } });
  await publish({ type: "kyc.case.escalated", sourceAppId: "kyc", actorId: priya.id, payload: { caseId: sanc.id, reference: sanc.reference } });
  await db.notification.createMany({
    data: [compliance, u("marcus.reid@demo.local")].map((usr) => ({ userId: usr.id, title: `${sanc.reference} escalated: sanctions hit`, body: `${priya.name} escalated ${sanc.applicantName}`, href: `/kyc/${sanc.id}`, appId: "kyc", createdAt: ago(4) })),
  });

  // --- Playground: one approved refund, one awaiting approval.
  const records = await db.playgroundRecord.findMany({ orderBy: { createdAt: "asc" } });
  if (records.length >= 2) {
    const [approved, pending] = records;
    await db.playgroundRecord.update({ where: { id: approved.id }, data: { status: "APPROVED" } });
    const done = await db.approvalRequest.create({
      data: { appId: "playground", type: "playground.record.approve", title: `Approve "${approved.title}" for ${approved.amount.toFixed(2)}`, description: "Demo maker-checker flow. Approving flips the record to APPROVED.", payload: { recordId: approved.id, title: approved.title, amount: approved.amount }, requiredPermission: "playground.record.approve", requestedById: maker.id, status: "APPROVED", decidedById: reviewer.id, decisionNote: "Matches the refund policy.", decidedAt: ago(26), createdAt: ago(27) },
    });
    await recordAudit(actor("maker@demo.local"), { appId: "playground", action: "record.submit", targetType: "PlaygroundRecord", targetId: approved.id, before: { status: "DRAFT" }, after: { status: "PENDING_APPROVAL" } });
    await recordAudit(actor("reviewer@demo.local"), { appId: "playground", action: "approval.approve", targetType: "ApprovalRequest", targetId: done.id, after: { decision: "APPROVED", note: "Matches the refund policy." } });

    await db.playgroundRecord.update({ where: { id: pending.id }, data: { status: "PENDING_APPROVAL" } });
    const open = await db.approvalRequest.create({
      data: { appId: "playground", type: "playground.record.approve", title: `Approve "${pending.title}" for ${pending.amount.toFixed(2)}`, description: "Demo maker-checker flow. Approving flips the record to APPROVED.", payload: { recordId: pending.id, title: pending.title, amount: pending.amount }, requiredPermission: "playground.record.approve", requestedById: maker.id, createdAt: ago(2) },
    });
    await recordAudit(actor("maker@demo.local"), { appId: "playground", action: "record.submit", targetType: "PlaygroundRecord", targetId: pending.id, before: { status: "DRAFT" }, after: { status: "PENDING_APPROVAL" } });
    await db.notification.createMany({ data: [reviewer, priya, admin].map((usr) => ({ userId: usr.id, title: `Approval needed: ${open.title}`, body: `Requested by ${maker.name}`, href: `/approvals/${open.id}`, appId: "playground", createdAt: ago(2) })) });
  }

  // --- App Builder: requests in every interesting state.
  const log = (startHoursAgo: number, extra: { step: string; detail?: string }[] = []) => {
    const t = (m: number) => new Date(Date.now() - startHoursAgo * HOUR + m * 60_000).toISOString();
    return [
      { at: t(0), step: "Session started (Mock Devin (PoC))" },
      { at: t(1), step: "Reading AGENTS.md and docs/APP_AUTHORING.md" },
      { at: t(3), step: "Scaffolding app" },
      { at: t(5), step: "Adding Prisma model and seed data" },
      { at: t(9), step: "Implementing pages, actions and server hooks" },
      { at: t(12), step: "Running lint, typecheck and tests", detail: "all green" },
      { at: t(13), step: "Opening pull request" },
      ...extra,
    ];
  };
  const refunds = await db.appRequest.create({
    data: {
      appId: "refunds", name: "Refunds Dashboard", status: "IN_REVIEW", requestedById: jordan.id,
      purpose: "Replace the Power Apps refunds dashboard: ops can see, filter and action customer refund requests with a four-eyes limit above £500.",
      requirements: "- Table of refund requests (order, customer, amount, reason, age) with filters\n- Approve / reject with mandatory note; > £500 requires a second approver\n- Daily totals and SLA breach badge\n- Emit refund.decided events for the finance ledger",
      sessionId: "devin-mock-7f3a2c", sessionUrl: "https://app.devin.ai/sessions/devin-mock-7f3a2c", branch: "apps/refunds",
      prUrl: "https://github.com/example/internal-tools/pull/118", previewUrl: null, buildLog: log(20), createdAt: ago(20), updatedAt: ago(3),
    },
  });
  await db.appRequest.update({ where: { id: refunds.id }, data: { previewUrl: `/builder/${refunds.id}/preview` } });
  const publishReq = await db.approvalRequest.create({
    data: {
      appId: "builder", type: "builder.app.publish", title: `Publish app "Refunds Dashboard" (/refunds)`,
      description: `${refunds.purpose}\n\nRequester's test notes: Tested approve/reject and the >£500 second-approver path on the preview — all good.\n\nPR: ${refunds.prUrl}`,
      payload: { requestId: refunds.id, appId: "refunds", name: refunds.name, prUrl: refunds.prUrl, previewUrl: `/builder/${refunds.id}/preview` },
      requiredPermission: "builder.request.review", requestedById: jordan.id, createdAt: ago(3),
    },
  });
  await recordAudit(actor("jordan.lee@demo.local"), { appId: "builder", action: "request.create", targetType: "AppRequest", targetId: refunds.id, after: { appId: "refunds", name: refunds.name } });
  await recordAudit(actor("jordan.lee@demo.local"), { appId: "builder", action: "request.submit", targetType: "AppRequest", targetId: refunds.id, before: { status: "READY_FOR_TESTING" }, after: { status: "IN_REVIEW" } });
  await db.notification.createMany({ data: [admin, reviewer].map((usr) => ({ userId: usr.id, title: `Approval needed: ${publishReq.title}`, body: `Requested by ${jordan.name}`, href: `/approvals/${publishReq.id}`, appId: "builder", createdAt: ago(3) })) });

  const vendors = await db.appRequest.create({
    data: {
      appId: "vendors", name: "Vendor Onboarding", status: "READY_FOR_TESTING", requestedById: maker.id,
      purpose: "Track new supplier onboarding: due-diligence checklist, bank detail verification and contract sign-off.",
      requirements: "- Vendor list with onboarding stage\n- Checklist per vendor (W-9/UBO/bank letter)\n- Bank detail change requires approval\n- Notify procurement on completion",
      sessionId: "devin-mock-b91e04", sessionUrl: "https://app.devin.ai/sessions/devin-mock-b91e04", branch: "apps/vendors",
      prUrl: "https://github.com/example/internal-tools/pull/121", buildLog: log(1), createdAt: ago(1), updatedAt: ago(0.7),
    },
  });
  await db.appRequest.update({ where: { id: vendors.id }, data: { previewUrl: `/builder/${vendors.id}/preview` } });
  await recordAudit(actor("maker@demo.local"), { appId: "builder", action: "request.create", targetType: "AppRequest", targetId: vendors.id, after: { appId: "vendors", name: vendors.name } });
  await db.notification.create({ data: { userId: maker.id, title: `"${vendors.name}" is ready to test`, body: "Open the preview, try it out, then send it for admin review.", href: `/builder/${vendors.id}`, appId: "builder", createdAt: ago(0.7) } });

  const expenses = await db.appRequest.create({
    data: {
      appId: "expenses", name: "Expense Claims", status: "REJECTED", requestedById: jordan.id,
      purpose: "Let staff submit expense claims with receipts; managers approve; finance exports to payroll.",
      requirements: "- Claim form with receipt upload\n- Manager approval\n- CSV export",
      sessionId: "devin-mock-2d77aa", sessionUrl: "https://app.devin.ai/sessions/devin-mock-2d77aa", branch: "apps/expenses",
      prUrl: "https://github.com/example/internal-tools/pull/109", buildLog: log(50),
      reviewNote: "Receipt upload stores files on local disk — use the kernel's attachment service instead, and the manager-approval step should reuse the approvals primitive rather than its own status field.",
      createdAt: ago(50), updatedAt: ago(44),
    },
  });
  await db.approvalRequest.create({
    data: { appId: "builder", type: "builder.app.publish", title: `Publish app "Expense Claims" (/expenses)`, description: expenses.purpose, payload: { requestId: expenses.id, appId: "expenses", name: expenses.name, prUrl: expenses.prUrl, previewUrl: null }, requiredPermission: "builder.request.review", requestedById: jordan.id, status: "REJECTED", decidedById: admin.id, decisionNote: expenses.reviewNote, decidedAt: ago(44), createdAt: ago(46) },
  });
  await recordAudit(actor("admin@demo.local"), { appId: "builder", action: "request.reject", targetType: "AppRequest", targetId: expenses.id, before: { status: "IN_REVIEW" }, after: { status: "REJECTED", note: expenses.reviewNote } });
  await db.notification.create({ data: { userId: jordan.id, title: `"${expenses.name}" was sent back`, body: expenses.reviewNote!, href: `/builder/${expenses.id}`, appId: "builder", readAt: ago(40), createdAt: ago(44) } });

  // --- Feature flag changes so /flags/history has a story.
  const flagAudit = async (who: string, key: string, before: Record<string, unknown>, after: Record<string, unknown>) =>
    recordAudit(actor(who), { appId: "kernel", action: "flag.update", targetType: "FeatureFlag", targetId: key, before, after });
  await flagAudit("admin@demo.local", "kyc.risk-breakdown", { enabled: false }, { enabled: true });
  await flagAudit("admin@demo.local", "kyc.new-queue-layout", { enabled: true, rules: { percentage: 5 } }, { enabled: true, rules: { percentage: 25 } });
  await flagAudit("maker@demo.local", "playground.beta-panel", { rules: { roles: ["engineer"] } }, { rules: { roles: ["admin", "engineer"] } });
  await flagAudit("admin@demo.local", "kyc.auto-approve-low-risk", { enabled: true }, { enabled: false });
  await publish({ type: "flag.updated", sourceAppId: "kernel", actorId: admin.id, payload: { key: "kyc.auto-approve-low-risk", enabled: false } });

  // --- Admin activity.
  await recordAudit(actor("admin@demo.local"), { appId: "kernel", action: "role.update", targetType: "Role", targetId: "compliance-lead", before: { permissions: ["kyc.*"] }, after: { permissions: ["kyc.*", "approvals.access", "audit.access", "kernel.audit.read"] } });
  await recordAudit(actor("admin@demo.local"), { appId: "kernel", action: "user.roles.update", targetType: "User", targetId: u("sofia.romano@demo.local").id, before: { roles: ["viewer"] }, after: { roles: ["viewer", "finance_analyst"] } });

  // --- Outbound webhook (inactive so the demo has no failing deliveries).
  await db.webhookSubscription.create({
    data: { name: "Slack #compliance-alerts", url: "https://hooks.slack.example.com/services/T000/B000/demo", eventTypes: "kyc.case.decided,kyc.case.escalated,app.published", secret: "whsec_demo_do_not_use", active: false },
  });

  await db.notification.create({ data: { userId: admin.id, title: "Welcome to the internal tools kernel", body: "3 approvals are waiting for you, 2 KYC cases need a supervisor, and an app is ready for review.", href: "/approvals", appId: "kernel", createdAt: ago(0.1) } });
  console.log("Seeded demo history: KYC decisions/notes, approvals, app requests, flag history, notifications");
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

  await seedDemoHistory();
  await seedAppInstalls();

  console.log(`Seeded ${roles.length} roles, ${users.length} users, ${flags.length} flags. Password for all demo users: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
