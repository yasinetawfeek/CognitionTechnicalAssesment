import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { listJobHandlers } from "@/kernel/jobs";
import { Alert, Badge, DataTable, LiveRefresh, PageHeader, RelativeTime, Stat, statusTone, tableParams, type SearchParams } from "@/kernel/ui";
import { EnqueueJobDialog, JobResult, RetryJobButton } from "../components/jobs";

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await pageContext("kernel.jobs.read", "/system/jobs");
  const { page, pageSize } = tableParams(await searchParams, { pageSize: 30 });
  const [rows, total, counts] = await Promise.all([
    db.job.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.job.count(),
    db.job.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const handlers = listJobHandlers();
  const canManage = ctx.can("kernel.jobs.manage");

  return (
    <>
      <LiveRefresh patterns={["job.*"]} />
      <PageHeader
        title="Background jobs"
        description="DB-backed queue polled by an in-process worker. This is where ML scoring (e.g. KYC outlier detection) plugs in."
        actions={canManage && <EnqueueJobDialog handlers={handlers} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Pending" value={count("PENDING")} tone="info" />
        <Stat label="Running" value={count("RUNNING")} tone="warning" />
        <Stat label="Done" value={count("DONE")} tone="success" />
        <Stat label="Failed" value={count("FAILED")} tone={count("FAILED") ? "danger" : "neutral"} />
      </div>
      {handlers.length === 0 && (
        <Alert tone="warning" title="No job handlers registered">
          Call <code className="font-mono text-xs">registerJobHandler(type, fn)</code> from an app&apos;s server.ts.
        </Alert>
      )}
      <div className="mt-6">
        <DataTable
          rows={rows}
          rowKey={(j) => j.id}
          dense
          pagination={{ page, pageSize, total }}
          columns={[
            { header: "Type", cell: (j) => <span className="font-mono text-xs">{j.type}</span> },
            { header: "Status", cell: (j) => <Badge tone={statusTone(j.status)}>{j.status}</Badge> },
            { header: "Attempts", cell: (j) => `${j.attempts}/${j.maxAttempts}`, className: "tabular-nums" },
            { header: "Queued", cell: (j) => <RelativeTime date={j.createdAt} className="text-muted" /> },
            {
              header: "Duration",
              cell: (j) => (j.startedAt && j.finishedAt ? `${j.finishedAt.getTime() - j.startedAt.getTime()} ms` : "—"),
              className: "tabular-nums text-muted",
            },
            { header: "Result / error", cell: (j) => <JobResult status={j.status} result={j.result} error={j.lastError} payload={j.payload} /> },
            {
              header: "",
              align: "right",
              cell: (j) => (canManage && j.status === "FAILED" ? <RetryJobButton id={j.id} /> : null),
            },
          ]}
        />
      </div>
    </>
  );
}
