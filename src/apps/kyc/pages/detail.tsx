import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, LiveRefresh, PageHeader, RelativeTime } from "@/kernel/ui";
import { needsSupervisorSignOff } from "../service";
import type { RiskFactor } from "../types";
import { CasePanel, NoteForm } from "../components/case-actions";
import { CaseStatusBadge } from "../components/case-table";
import { RiskBreakdown } from "../components/risk";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext("kyc.case.read", `/kyc/${id}`);
  const kycCase = await db.kycCase.findUnique({ where: { id }, include: { notes: { orderBy: { createdAt: "desc" } } } });
  if (!kycCase) notFound();

  const userIds = [kycCase.assignedToId, kycCase.decidedById, kycCase.createdById, ...kycCase.notes.map((n) => n.authorId)].filter((v): v is string => !!v);
  const [users, history, approval] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    db.auditLog.findMany({ where: { targetType: "KycCase", targetId: id }, orderBy: { seq: "desc" }, take: 50 }),
    kycCase.approvalRequestId ? db.approvalRequest.findUnique({ where: { id: kycCase.approvalRequestId }, select: { id: true, status: true } }) : null,
  ]);
  const nameOf = (uid: string | null) => (uid === null ? "System" : uid === ctx.user.id ? "You" : users.find((u) => u.id === uid)?.name ?? "Unknown");
  const factors = (kycCase.riskFactors as RiskFactor[] | null) ?? [];
  const age = Math.floor((Date.now() - kycCase.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000));

  return (
    <>
      <LiveRefresh patterns={["kyc.*", "approval.*"]} />
      <PageHeader
        breadcrumb={<Link href="/kyc">Review queue</Link>}
        title={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono">{kycCase.reference}</span>
            <span>{kycCase.applicantName}</span>
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Submitted <RelativeTime date={kycCase.submittedAt} />
            {kycCase.assignedToId && <span>· assigned to {nameOf(kycCase.assignedToId)}</span>}
          </span>
        }
        actions={
          <span className="inline-flex items-center gap-2">
            {kycCase.sanctionsHit && <Badge tone="danger">SANCTIONS HIT</Badge>}
            {kycCase.pepMatch && <Badge tone="warning">PEP</Badge>}
            <CaseStatusBadge status={kycCase.status} />
          </span>
        }
      />

      {kycCase.status === "APPROVED" || kycCase.status === "REJECTED" ? (
        <div className="mb-6">
          <Alert tone={kycCase.status === "APPROVED" ? "success" : "danger"} title={`${kycCase.status} by ${nameOf(kycCase.decidedById)}`}>
            {kycCase.decisionNote ? <em>&ldquo;{kycCase.decisionNote}&rdquo;</em> : "No decision note."}
            {kycCase.decidedAt && (
              <span className="ml-2 text-xs opacity-80">
                <RelativeTime date={kycCase.decidedAt} />
              </span>
            )}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Risk assessment" description={kycCase.scoredAt ? <>Scored <RelativeTime date={kycCase.scoredAt} /> by the kyc.score-case job</> : "Queued for scoring"} />
            <CardBody>
              <RiskBreakdown score={kycCase.riskScore} level={kycCase.riskLevel} factors={factors} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Applicant" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Name", value: kycCase.applicantName },
                  { label: "Email", value: kycCase.email },
                  { label: "Country", value: <span className="font-mono">{kycCase.country}</span> },
                  { label: "Date of birth", value: `${kycCase.dateOfBirth.toISOString().slice(0, 10)} (${age})` },
                  { label: "Document", value: `${kycCase.documentType.replace("_", " ")} · ${kycCase.documentNumber}` },
                  { label: "Declared annual income", value: kycCase.declaredIncome.toLocaleString() },
                  { label: "Initial deposit", value: kycCase.initialDeposit.toLocaleString() },
                  { label: "Watch-lists", value: kycCase.sanctionsHit ? "Sanctions hit" : kycCase.pepMatch ? "PEP match" : "Clear" },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Case notes" description="Notes are part of the audit trail and can't be edited." />
            <CardBody className="space-y-4">
              {ctx.can("kyc.case.note") && <NoteForm id={kycCase.id} />}
              {kycCase.notes.length === 0 ? (
                <p className="text-sm text-muted">No notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {kycCase.notes.map((n) => (
                    <li key={n.id} className="rounded-md border border-border bg-bg px-3 py-2 text-sm">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted">
                        <span className="font-medium text-fg">{n.authorId === "system" ? "System" : nameOf(n.authorId)}</span>
                        <RelativeTime date={n.createdAt} />
                      </div>
                      <p className="whitespace-pre-wrap">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Actions" />
            <CardBody>
              {approval && kycCase.status === "PENDING_APPROVAL" && (
                <p className="mb-3 text-sm">
                  <Link href={`/approvals/${approval.id}`} className="text-primary hover:underline">
                    Open the approval request →
                  </Link>
                </p>
              )}
              <CasePanel
                id={kycCase.id}
                status={kycCase.status}
                assigned={!!kycCase.assignedToId}
                assignedToMe={kycCase.assignedToId === ctx.user.id}
                scored={kycCase.riskScore !== null}
                needsSignOff={needsSupervisorSignOff(kycCase)}
                caps={{
                  canAssign: ctx.can("kyc.case.assign"),
                  canDecide: ctx.can("kyc.case.decide"),
                  canSupervise: ctx.can("kyc.case.supervise"),
                  canNote: ctx.can("kyc.case.note"),
                  canRescore: ctx.can("kyc.case.create"),
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="History" description="From the kernel audit log." />
            <CardBody className="p-0">
              <ol className="divide-y divide-border text-sm">
                {history.map((h) => (
                  <li key={h.seq} className="flex items-start justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <span className="font-mono text-xs">{h.action.replace("case.", "")}</span>
                      <div className="truncate text-xs text-muted">{h.actorId ? nameOf(h.actorId) : "System"}</div>
                    </div>
                    <RelativeTime date={h.ts} className="shrink-0 text-xs text-muted" />
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
