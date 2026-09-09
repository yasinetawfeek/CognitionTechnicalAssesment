import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { isEnabled } from "@/kernel/flags";
import { Alert, Badge, Card, CardBody, CardHeader, DataTable, LiveRefresh, PageHeader, RelativeTime, statusTone } from "@/kernel/ui";
import { CreateRecordDialog, RecordActions, RiskScore } from "../components/records";
import { BetaPanel } from "../components/beta-panel";

export default async function RecordsPage() {
  const ctx = await pageContext(undefined, "/playground");
  const [records, users, betaEnabled] = await Promise.all([
    db.playgroundRecord.findMany({ orderBy: { createdAt: "desc" } }),
    db.user.findMany({ select: { id: true, name: true } }),
    // Server-side flag check (for data you don't want to ship at all). Client-side `useFlag()` re-evaluates live.
    isEnabled("playground.beta-panel", ctx.user),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <>
      <LiveRefresh patterns={["playground.*", "approval.*"]} />
      <PageHeader
        title="Records"
        description="Create a record → a scoring job runs (demo ML) → submit for approval → a different user approves. Every step is audited and published as an event."
        actions={ctx.can("playground.record.create") && <CreateRecordDialog />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            rows={records}
            rowKey={(r) => r.id}
            emptyTitle="No records yet"
            emptyDescription="Create one to see the audit log, event stream and job queue light up."
            columns={[
              { header: "Title", cell: (r) => <span className="font-medium">{r.title}</span> },
              { header: "Amount", cell: (r) => r.amount.toFixed(2), align: "right", className: "tabular-nums" },
              { header: "Risk", cell: (r) => <RiskScore score={r.riskScore} /> },
              { header: "Status", cell: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace("_", " ")}</Badge> },
              { header: "By", cell: (r) => <span className="text-muted">{nameOf.get(r.createdById) ?? "?"}</span> },
              { header: "Updated", cell: (r) => <RelativeTime date={r.updatedAt} className="text-muted" /> },
              {
                header: "",
                align: "right",
                cell: (r) => (
                  <RecordActions
                    id={r.id}
                    status={r.status}
                    canSubmit={ctx.can("playground.record.submit")}
                    canDelete={ctx.can("playground.record.delete")}
                    canRescore={ctx.can("playground.record.create")}
                  />
                ),
              },
            ]}
          />
        </div>
        <div className="space-y-6">
          <BetaPanel serverEnabled={betaEnabled} />
          <Card>
            <CardHeader title="Your permissions here" />
            <CardBody>
              <div className="flex flex-wrap gap-1">
                {["playground.access", "playground.record.create", "playground.record.submit", "playground.record.approve", "playground.record.delete"].map((p) => (
                  <Badge key={p} tone={ctx.can(p) ? "success" : "neutral"}>
                    <span className="font-mono">{p.replace("playground.", "")}</span>
                  </Badge>
                ))}
              </div>
              {!ctx.can("playground.record.approve") && (
                <Alert tone="info">Sign in as a different user with the approve permission to complete the four-eyes flow.</Alert>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
