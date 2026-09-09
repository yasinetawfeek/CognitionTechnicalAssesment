import type { Prisma } from "@prisma/client";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { LiveRefresh, PageHeader, Stat, tableParams, type SearchParams } from "@/kernel/ui";
import { CASE_STATUSES, OPEN_STATUSES, RISK_LEVELS, type CaseStatus, type RiskLevel } from "../types";
import { CaseTable } from "../components/case-table";
import { CreateCaseDialog } from "../components/create-case";
import { QueueFilters } from "../components/queue-filters";

export default async function QueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await pageContext("kyc.case.read", "/kyc");
  const sp = await searchParams;
  const { page, pageSize, q, skip, take, get } = tableParams(sp, { pageSize: 20 });

  const status = get("status") ?? "";
  const risk = get("risk") ?? "";
  const where: Prisma.KycCaseWhereInput = {};
  if (status === "ALL") {
    // no status filter
  } else if (CASE_STATUSES.includes(status as CaseStatus)) {
    where.status = status;
  } else {
    where.status = { in: OPEN_STATUSES };
  }
  if (RISK_LEVELS.includes(risk as RiskLevel)) where.riskLevel = risk;
  else if (risk === "UNSCORED") where.riskScore = null;
  if (get("unassigned") === "1") where.assignedToId = null;
  if (q) where.OR = [{ applicantName: { contains: q } }, { email: { contains: q } }, { reference: { contains: q } }];

  const [rows, total, users, openCount, unassigned, highRisk, pendingApproval, escalated] = await Promise.all([
    db.kycCase.findMany({
      where,
      // Risk-first triage: highest score first, oldest first on ties, unscored last.
      orderBy: [{ riskScore: { sort: "desc", nulls: "last" } }, { submittedAt: "asc" }],
      skip,
      take,
    }),
    db.kycCase.count({ where }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.kycCase.count({ where: { status: { in: OPEN_STATUSES } } }),
    db.kycCase.count({ where: { status: "NEW", assignedToId: null } }),
    db.kycCase.count({ where: { status: { in: OPEN_STATUSES }, riskLevel: "HIGH" } }),
    db.kycCase.count({ where: { status: "PENDING_APPROVAL" } }),
    db.kycCase.count({ where: { status: "ESCALATED" } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <>
      <LiveRefresh patterns={["kyc.*", "approval.*"]} />
      <PageHeader
        title="Review queue"
        description="Cases are scored on arrival, reviewers claim and decide them, high-risk approvals go to a supervisor for sign-off."
        actions={ctx.can("kyc.case.create") && <CreateCaseDialog />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Open" value={openCount} />
        <Stat label="Unclaimed" value={unassigned} hint="NEW and unassigned" />
        <Stat label="High risk open" value={highRisk} tone={highRisk > 0 ? "danger" : undefined} />
        <Stat label="Awaiting sign-off" value={pendingApproval} hint="four-eyes" />
        <Stat label="Escalated" value={escalated} tone={escalated > 0 ? "danger" : undefined} />
      </div>
      <QueueFilters />
      <CaseTable
        rows={rows}
        nameOf={nameOf}
        currentUserId={ctx.user.id}
        canClaim={ctx.can("kyc.case.assign")}
        canSupervise={ctx.can("kyc.case.supervise")}
        pagination={{ page, pageSize, total }}
        emptyDescription={q || status || risk ? "No cases match these filters." : "New onboarding cases will appear here as they arrive."}
      />
    </>
  );
}
