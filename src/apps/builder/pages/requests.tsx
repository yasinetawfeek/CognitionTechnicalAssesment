import Link from "next/link";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Alert, Badge, DataTable, LiveRefresh, PageHeader, RelativeTime } from "@/kernel/ui";
import { NewAppDialog } from "../components/forms";
import { requestTone, statusLabel } from "../status";

export default async function RequestsPage() {
  const ctx = await pageContext(undefined, "/builder");
  const [requests, users] = await Promise.all([
    db.appRequest.findMany({ orderBy: { createdAt: "desc" } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <>
      <LiveRefresh patterns={["apprequest.*", "app.published", "approval.*"]} />
      <PageHeader
        title="App requests"
        description="Describe an app → Devin builds it on a branch → you test the preview → an admin reviews and publishes. Every step is audited."
        actions={ctx.can("builder.request.create") && <NewAppDialog />}
      />
      {!ctx.can("builder.request.create") && <Alert tone="info">You can view requests but need <span className="font-mono">builder.request.create</span> to make one.</Alert>}
      <DataTable
        rows={requests}
        rowKey={(r) => r.id}
        emptyTitle="No app requests yet"
        emptyDescription="Ask for the refunds dashboard and watch the build log stream in."
        columns={[
          {
            header: "App",
            cell: (r) => (
              <Link href={`/builder/${r.id}`} className="font-medium hover:underline">
                {r.name} <span className="font-mono text-xs text-muted">/{r.appId}</span>
              </Link>
            ),
          },
          { header: "Status", cell: (r) => <Badge tone={requestTone(r.status)}>{statusLabel(r.status)}</Badge> },
          { header: "Requested by", cell: (r) => <span className="text-muted">{nameOf.get(r.requestedById) ?? "?"}</span> },
          { header: "PR", cell: (r) => (r.prUrl ? <a href={r.prUrl} className="text-xs text-primary hover:underline" target="_blank" rel="noreferrer">{r.prUrl.replace(/^https?:\/\//, "")}</a> : <span className="text-xs text-muted">—</span>) },
          { header: "Updated", cell: (r) => <RelativeTime date={r.updatedAt} className="text-muted" /> },
        ]}
      />
    </>
  );
}
