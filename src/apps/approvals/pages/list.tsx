import type { Prisma } from "@prisma/client";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Badge, DataTable, LiveRefresh, PageHeader, RelativeTime, statusTone, tableParams, type SearchParams } from "@/kernel/ui";

type Mode = "inbox" | "mine" | "history";

const copy: Record<Mode, { title: string; description: string; empty: string }> = {
  inbox: {
    title: "Approvals inbox",
    description: "Pending requests you are allowed to decide. You can never approve your own request.",
    empty: "Nothing waiting for you",
  },
  mine: { title: "My requests", description: "Requests you opened and their current status.", empty: "You haven't requested anything" },
  history: { title: "History", description: "All decided or cancelled requests you can see.", empty: "No decisions yet" },
};

export function approvalsListPage(mode: Mode) {
  return async function ApprovalsListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const ctx = await pageContext("kernel.approvals.read", `/approvals${mode === "inbox" ? "" : `/${mode}`}`);
    const { page, pageSize } = tableParams(await searchParams, { pageSize: 25 });

    const where: Prisma.ApprovalRequestWhereInput =
      mode === "inbox"
        ? { status: "PENDING", requestedById: { not: ctx.user.id } }
        : mode === "mine"
          ? { requestedById: ctx.user.id }
          : { status: { not: "PENDING" } };

    const [all, total] = await Promise.all([
      db.approvalRequest.findMany({
        where,
        include: { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.approvalRequest.count({ where }),
    ]);
    // Inbox only shows requests the viewer can actually decide.
    const rows = mode === "inbox" ? all.filter((r) => ctx.can(r.requiredPermission)) : all;

    return (
      <>
        <LiveRefresh patterns={["approval.*"]} />
        <PageHeader title={copy[mode].title} description={copy[mode].description} />
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/approvals/${r.id}`}
          emptyTitle={copy[mode].empty}
          pagination={mode === "inbox" ? undefined : { page, pageSize, total }}
          columns={[
            {
              header: "Request",
              cell: (r) => (
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="font-mono text-xs text-muted">{r.type}</div>
                </div>
              ),
            },
            { header: "App", cell: (r) => <Badge tone="primary">{r.appId}</Badge> },
            { header: "Requested by", cell: (r) => r.requestedBy.name },
            { header: "Needs", cell: (r) => <span className="font-mono text-xs">{r.requiredPermission}</span> },
            { header: "Status", cell: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
            {
              header: mode === "history" ? "Decided" : "Opened",
              cell: (r) => (
                <span className="text-muted">
                  <RelativeTime date={mode === "history" && r.decidedAt ? r.decidedAt : r.createdAt} />
                  {mode === "history" && r.decidedBy && <span className="ml-1">by {r.decidedBy.name}</span>}
                </span>
              ),
            },
          ]}
        />
      </>
    );
  };
}
