import type { FinanceDeadline } from "@prisma/client";
import { Badge, DataTable, RelativeTime, type Tone } from "@/kernel/ui";
import { dueInWords, stageFor } from "../reminders";
import { describeAudience } from "../visibility";
import { regionLabel } from "../regions";
import { DeadlineRowActions } from "./row-actions";

export function urgencyTone(deadline: Pick<FinanceDeadline, "dueAt" | "status">): Tone {
  if (deadline.status === "COMPLETED") return "success";
  const stage = stageFor(deadline.dueAt);
  if (stage === "OVERDUE") return "danger";
  if (stage === "T1" || stage === "T7") return "warning";
  return "neutral";
}

export function DeadlineTable({
  deadlines,
  names,
  canComplete,
  canDelete,
  emptyTitle,
  emptyDescription,
}: {
  deadlines: FinanceDeadline[];
  names: { roles: Map<string, string>; users: Map<string, string> };
  canComplete: boolean;
  canDelete: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <DataTable
      rows={deadlines}
      rowKey={(d) => d.id}
      rowHref={(d) => `/deadlines/${d.id}`}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      columns={[
        {
          header: "Deadline",
          cell: (d) => (
            <span>
              <span className="font-medium">{d.title}</span>
              <span className="ml-2 font-mono text-xs text-muted">{d.reference}</span>
            </span>
          ),
        },
        { header: "Category", cell: (d) => <Badge tone="info">{d.category}</Badge> },
        { header: "Entity", cell: (d) => <span className="text-muted">{d.entity || "—"}</span> },
        { header: "Region", cell: (d) => <span className="text-muted">{regionLabel(d.region)}</span> },
        {
          header: "Due",
          cell: (d) => (
            <span className="whitespace-nowrap">
              <RelativeTime date={d.dueAt} />
              {d.status === "OPEN" && <span className="ml-2 text-xs text-muted">{dueInWords(d.dueAt)}</span>}
            </span>
          ),
        },
        { header: "Owner", cell: (d) => <span className="text-muted">{names.users.get(d.ownerId) ?? "—"}</span> },
        { header: "Visible to", cell: (d) => <span className="text-muted">{describeAudience(d, names)}</span> },
        {
          header: "Status",
          cell: (d) => <Badge tone={urgencyTone(d)}>{d.status === "COMPLETED" ? "MET" : (stageFor(d.dueAt) ?? "SCHEDULED")}</Badge>,
        },
        {
          header: "",
          align: "right",
          cell: (d) => <DeadlineRowActions id={d.id} status={d.status} canComplete={canComplete} canDelete={canDelete} />,
        },
      ]}
    />
  );
}
