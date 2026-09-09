import type { KycCase } from "@prisma/client";
import { Badge, DataTable, RelativeTime, type PaginationInfo } from "@/kernel/ui";
import { caseStatusTone } from "../tones";
import { ClaimButton } from "./case-actions";
import { RiskBadge } from "./risk";

export function CaseStatusBadge({ status }: { status: string }) {
  return <Badge tone={caseStatusTone(status)}>{status.replace("_", " ")}</Badge>;
}

export function CaseTable({
  rows,
  nameOf,
  currentUserId,
  canClaim,
  canSupervise,
  pagination,
  emptyTitle = "Queue is empty",
  emptyDescription,
}: {
  rows: KycCase[];
  nameOf: Map<string, string>;
  currentUserId: string;
  canClaim: boolean;
  canSupervise: boolean;
  pagination?: PaginationInfo;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <DataTable
      rows={rows}
      rowKey={(c) => c.id}
      rowHref={(c) => `/kyc/${c.id}`}
      pagination={pagination}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      columns={[
        { header: "Ref", cell: (c) => <span className="font-mono text-xs font-medium">{c.reference}</span> },
        {
          header: "Applicant",
          cell: (c) => (
            <div>
              <div className="font-medium">{c.applicantName}</div>
              <div className="text-xs text-muted">{c.email}</div>
            </div>
          ),
        },
        { header: "Country", cell: (c) => <span className="font-mono text-xs">{c.country}</span> },
        { header: "Deposit", cell: (c) => c.initialDeposit.toLocaleString(undefined, { maximumFractionDigits: 0 }), align: "right", className: "tabular-nums" },
        {
          header: "Risk",
          cell: (c) => (
            <span className="inline-flex items-center gap-1.5">
              <RiskBadge score={c.riskScore} level={c.riskLevel} />
              {c.sanctionsHit && <Badge tone="danger">SANCTIONS</Badge>}
              {c.pepMatch && <Badge tone="warning">PEP</Badge>}
            </span>
          ),
        },
        { header: "Status", cell: (c) => <CaseStatusBadge status={c.status} /> },
        {
          header: "Assignee",
          cell: (c) => (c.assignedToId ? <span className={c.assignedToId === currentUserId ? "font-medium" : "text-muted"}>{c.assignedToId === currentUserId ? "You" : nameOf.get(c.assignedToId) ?? "?"}</span> : <span className="text-muted">—</span>),
        },
        { header: "Submitted", cell: (c) => <RelativeTime date={c.submittedAt} className="text-muted" /> },
        {
          header: "",
          align: "right",
          cell: (c) =>
            canClaim && !c.assignedToId && (c.status === "NEW" || (c.status === "ESCALATED" && canSupervise)) ? <ClaimButton id={c.id} /> : null,
        },
      ]}
    />
  );
}
