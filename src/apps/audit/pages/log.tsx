import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { listApps } from "@/kernel/apps/registry";
import { Badge, DataTable, LiveRefresh, PageHeader, RelativeTime, SearchBox, tableParams, type SearchParams } from "@/kernel/ui";
import { AuditFilters } from "../components/filters";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await pageContext("kernel.audit.read", "/audit");
  const sp = await searchParams;
  const { page, pageSize, q } = tableParams(sp, { pageSize: 50 });
  const appId = typeof sp.app === "string" && sp.app ? sp.app : undefined;
  const actor = typeof sp.actor === "string" && sp.actor ? sp.actor : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(appId ? { appId } : {}),
    ...(actor ? { actorEmail: actor } : {}),
    ...(q
      ? { OR: [{ action: { contains: q } }, { targetType: { contains: q } }, { targetId: { contains: q } }, { actorEmail: { contains: q } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { seq: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.auditLog.count({ where }),
  ]);

  return (
    <>
      <LiveRefresh patterns={["kernel.*", "flag.*", "approval.*"]} debounceMs={1000} />
      <PageHeader
        title="Audit log"
        description="Append-only, SHA-256 hash-chained. Each row commits to the one before it, so edits or deletions are detectable."
        actions={
          <>
            <AuditFilters apps={[{ id: "kernel", name: "Kernel" }, ...listApps().map((a) => ({ id: a.id, name: a.name }))]} />
            <SearchBox placeholder="action, target, actor…" />
          </>
        }
      />
      <DataTable
        rows={rows}
        rowKey={(r) => String(r.seq)}
        rowHref={(r) => `/audit/${r.seq}`}
        dense
        pagination={{ page, pageSize, total }}
        columns={[
          { header: "#", cell: (r) => <span className="font-mono text-xs">{r.seq}</span>, className: "w-16" },
          { header: "When", cell: (r) => <RelativeTime date={r.ts} className="text-muted" /> },
          {
            header: "Actor",
            cell: (r) => (
              <Link href={`/audit?actor=${encodeURIComponent(r.actorEmail)}`} className="hover:underline">
                {r.actorEmail}
              </Link>
            ),
          },
          { header: "App", cell: (r) => <Badge tone={r.appId === "kernel" ? "neutral" : "primary"}>{r.appId}</Badge> },
          { header: "Action", cell: (r) => <span className="font-mono text-xs">{r.action}</span> },
          {
            header: "Target",
            cell: (r) => (
              <span className="text-muted">
                {r.targetType}
                {r.targetId && <span className="ml-1 font-mono text-xs">{r.targetId.slice(0, 12)}</span>}
              </span>
            ),
          },
          { header: "Hash", cell: (r) => <span className="font-mono text-[11px] text-muted">{r.hash.slice(0, 12)}…</span> },
        ]}
      />
    </>
  );
}
