import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Badge, Card, CardBody, CardHeader, DataTable, InlineAction, LiveRefresh, PageHeader, RelativeTime, statusTone } from "@/kernel/ui";
import { CreateWebhookDialog } from "../components/webhooks";
import { deleteWebhookAction, flushWebhooksAction, toggleWebhookAction } from "../actions";

export default async function WebhooksPage() {
  await pageContext("kernel.webhooks.manage", "/system/webhooks");
  const [subs, deliveries] = await Promise.all([
    db.webhookSubscription.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { deliveries: true } } } }),
    db.webhookDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { subscription: { select: { name: true } }, event: { select: { type: true } } } }),
  ]);

  return (
    <>
      <LiveRefresh patterns={["*"]} debounceMs={1500} />
      <PageHeader
        title="Outbound webhooks"
        description="Subscribe external systems (Slack, data warehouse, SIEM) to kernel events. Deliveries are queued in an outbox, signed with HMAC-SHA256 and retried with backoff."
        actions={
          <>
            <InlineAction action={flushWebhooksAction} variant="secondary">
              Deliver pending now
            </InlineAction>
            <CreateWebhookDialog />
          </>
        }
      />
      <DataTable
        rows={subs}
        rowKey={(s) => s.id}
        emptyTitle="No webhook subscriptions"
        emptyDescription="Create one to push events to an external URL."
        columns={[
          {
            header: "Subscription",
            cell: (s) => (
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="font-mono text-xs text-muted">{s.url}</div>
              </div>
            ),
          },
          {
            header: "Events",
            cell: (s) => (
              <div className="flex flex-wrap gap-1">
                {s.eventTypes.split(",").map((p) => (
                  <Badge key={p}>
                    <span className="font-mono">{p}</span>
                  </Badge>
                ))}
              </div>
            ),
          },
          { header: "Deliveries", cell: (s) => s._count.deliveries, className: "tabular-nums" },
          { header: "Status", cell: (s) => <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "active" : "paused"}</Badge> },
          {
            header: "",
            align: "right",
            cell: (s) => (
              <div className="flex justify-end gap-1">
                <InlineAction action={toggleWebhookAction} values={{ id: s.id }} variant="ghost" size="sm">
                  {s.active ? "Pause" : "Resume"}
                </InlineAction>
                <InlineAction action={deleteWebhookAction} values={{ id: s.id }} variant="ghost" size="sm" confirm="Delete this subscription and its delivery history?">
                  Delete
                </InlineAction>
              </div>
            ),
          },
        ]}
      />
      <Card className="mt-6">
        <CardHeader title="Recent deliveries" description="Newest 30 attempts across all subscriptions" />
        <CardBody className="p-0">
          <DataTable
            rows={deliveries}
            rowKey={(d) => d.id}
            dense
            emptyTitle="No deliveries yet"
            columns={[
              { header: "When", cell: (d) => <RelativeTime date={d.createdAt} className="text-muted" /> },
              { header: "Subscription", cell: (d) => d.subscription.name },
              { header: "Event", cell: (d) => <span className="font-mono text-xs">{d.event.type}</span> },
              { header: "Status", cell: (d) => <Badge tone={statusTone(d.status)}>{d.status}</Badge> },
              { header: "Attempts", cell: (d) => d.attempts, className: "tabular-nums" },
              { header: "Response", cell: (d) => <span className="text-xs text-muted">{d.responseStatus ?? d.lastError ?? "—"}</span> },
            ]}
          />
        </CardBody>
      </Card>
    </>
  );
}
