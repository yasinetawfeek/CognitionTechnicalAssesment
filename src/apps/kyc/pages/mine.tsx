import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Card, CardBody, CardHeader, LiveRefresh, PageHeader, RelativeTime } from "@/kernel/ui";
import Link from "next/link";
import { OPEN_STATUSES } from "../types";
import { CaseStatusBadge, CaseTable } from "../components/case-table";

export default async function MyCasesPage() {
  const ctx = await pageContext("kyc.case.assign", "/kyc/mine");
  const [open, recent] = await Promise.all([
    db.kycCase.findMany({ where: { assignedToId: ctx.user.id, status: { in: OPEN_STATUSES } }, orderBy: [{ riskScore: { sort: "desc", nulls: "last" } }, { submittedAt: "asc" }] }),
    db.kycCase.findMany({ where: { decidedById: ctx.user.id }, orderBy: { decidedAt: "desc" }, take: 10 }),
  ]);

  return (
    <>
      <LiveRefresh patterns={["kyc.*", "approval.*"]} />
      <PageHeader title="My cases" description="Cases you have claimed, plus your most recent decisions." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CaseTable
            rows={open}
            nameOf={new Map([[ctx.user.id, ctx.user.name]])}
            currentUserId={ctx.user.id}
            canClaim={false}
            canSupervise={ctx.can("kyc.case.supervise")}
            emptyTitle="Nothing claimed"
            emptyDescription="Claim a case from the queue to start reviewing."
          />
        </div>
        <Card className="self-start">
          <CardHeader title="Recent decisions" />
          <CardBody className="p-0">
            {recent.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No decisions yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recent.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/kyc/${c.id}`} className="font-mono text-xs text-primary hover:underline">
                        {c.reference}
                      </Link>
                      <div className="truncate">{c.applicantName}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <CaseStatusBadge status={c.status} />
                      {c.decidedAt && <RelativeTime date={c.decidedAt} className="text-xs text-muted" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
