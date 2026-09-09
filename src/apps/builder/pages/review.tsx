import Link from "next/link";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Badge, DataTable, LinkButton, LiveRefresh, PageHeader, RelativeTime, statusTone } from "@/kernel/ui";
import type { PublishApprovalPayload } from "../types";

export default async function ReviewQueuePage() {
  await pageContext("builder.request.review", "/builder/review");
  const pending = await db.approvalRequest.findMany({
    where: { type: "builder.app.publish", status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { requestedBy: { select: { name: true } } },
  });

  return (
    <>
      <LiveRefresh patterns={["approval.*", "apprequest.*"]} />
      <PageHeader
        title="Review queue"
        description="Apps that have been built and tested by their requester. Approving merges the branch and publishes the app; the four-eyes rule applies."
      />
      <DataTable
        rows={pending}
        rowKey={(r) => r.id}
        emptyTitle="Nothing to review"
        emptyDescription="Requests appear here once their requester has tested the preview and sent them for review."
        columns={[
          {
            header: "App",
            cell: (r) => {
              const p = r.payload as unknown as PublishApprovalPayload;
              return (
                <Link href={`/builder/${p.requestId}`} className="font-medium hover:underline">
                  {p.name} <span className="font-mono text-xs text-muted">/{p.appId}</span>
                </Link>
              );
            },
          },
          { header: "Requested by", cell: (r) => <span className="text-muted">{r.requestedBy.name}</span> },
          { header: "Waiting", cell: (r) => <RelativeTime date={r.createdAt} className="text-muted" /> },
          { header: "Status", cell: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
          {
            header: "",
            align: "right",
            cell: (r) => {
              const p = r.payload as unknown as PublishApprovalPayload;
              return (
                <div className="flex justify-end gap-1">
                  {p.previewUrl && (
                    <LinkButton href={p.previewUrl} size="sm" variant="ghost">
                      Preview
                    </LinkButton>
                  )}
                  <LinkButton href={`/approvals/${r.id}`} size="sm" variant="secondary">
                    Decide
                  </LinkButton>
                </div>
              );
            },
          },
        ]}
      />
    </>
  );
}
