import Link from "next/link";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Badge, DataTable, JsonView, LiveRefresh, PageHeader, RelativeTime } from "@/kernel/ui";

export default async function FlagHistoryPage() {
  await pageContext("kernel.audit.read", "/flags/history");
  const rows = await db.auditLog.findMany({
    where: { targetType: "FeatureFlag" },
    orderBy: { seq: "desc" },
    take: 100,
  });

  return (
    <>
      <LiveRefresh patterns={["flag.*"]} />
      <PageHeader title="Flag history" description="Every flag change, straight from the tamper-evident audit log." />
      <div className="mt-6">
        <DataTable
          rows={rows}
          rowKey={(r) => String(r.seq)}
          emptyTitle="No flag changes yet"
          columns={[
            { header: "When", cell: (r) => <RelativeTime date={r.ts} className="text-muted" /> },
            { header: "Flag", cell: (r) => <span className="font-mono text-sm">{r.targetId}</span> },
            { header: "Change", cell: (r) => <Badge tone={r.action === "flag.delete" ? "danger" : "info"}>{r.action.replace("flag.", "")}</Badge> },
            { header: "By", cell: (r) => <span className="text-sm">{r.actorEmail}</span> },
            {
              header: "After",
              cell: (r) => (r.after ? <JsonView value={r.after} className="max-w-md text-xs" /> : <span className="text-xs text-muted">—</span>),
            },
            {
              header: "",
              align: "right",
              cell: (r) => (
                <Link href={`/audit/${r.seq}`} className="text-xs text-primary hover:underline">
                  #{r.seq}
                </Link>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
