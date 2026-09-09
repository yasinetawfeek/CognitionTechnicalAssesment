import type { Prisma } from "@prisma/client";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { listSubscriptions, streamListenerCount } from "@/kernel/events/bus";
import { listAllEventTypes } from "@/kernel/apps/registry";
import { KERNEL_EVENTS } from "@/kernel/events";
import { Badge, Card, CardBody, CardHeader, DataTable, LiveRefresh, PageHeader, RelativeTime, SearchBox, Stat, tableParams, type SearchParams } from "@/kernel/ui";
import { EventPayload, PublishEventDialog } from "../components/events";

export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await pageContext("kernel.events.read", "/system");
  const { page, pageSize, q } = tableParams(await searchParams, { pageSize: 30 });
  const where: Prisma.EventWhereInput = q ? { OR: [{ type: { contains: q } }, { sourceAppId: { contains: q } }] } : {};
  const [rows, total, subs] = await Promise.all([
    db.event.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.event.count({ where }),
    Promise.resolve(listSubscriptions()),
  ]);
  const declared = [...KERNEL_EVENTS.map((e) => ({ ...e, appId: "kernel" })), ...listAllEventTypes()];

  return (
    <>
      <LiveRefresh patterns={["*"]} debounceMs={400} />
      <PageHeader
        title="Event stream"
        description="Every event published through the kernel bus. Persisted, fanned out to server subscribers, pushed to browsers over SSE, and queued for webhooks."
        actions={
          <>
            <SearchBox placeholder="type or source app…" />
            <PublishEventDialog />
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Events stored" value={total} />
        <Stat label="Server subscribers" value={subs.length} hint={subs.map((s) => s.pattern).join(", ") || "none"} />
        <Stat label="Live browser clients" value={streamListenerCount()} hint="SSE connections on this process" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            dense
            pagination={{ page, pageSize, total }}
            columns={[
              { header: "When", cell: (e) => <RelativeTime date={e.createdAt} className="text-muted" />, className: "w-24" },
              { header: "Type", cell: (e) => <span className="font-mono text-xs">{e.type}</span> },
              { header: "Source", cell: (e) => <Badge tone={e.sourceAppId === "kernel" ? "neutral" : "primary"}>{e.sourceAppId}</Badge> },
              { header: "Payload", cell: (e) => <EventPayload value={e.payload} /> },
            ]}
          />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Declared event types" description="From kernel + app manifests" />
            <CardBody className="p-0">
              <ul className="divide-y divide-border text-sm">
                {declared.map((e) => (
                  <li key={e.type} className="px-5 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{e.type}</span>
                      <Badge tone="neutral">{e.appId}</Badge>
                    </div>
                    <p className="text-xs text-muted">{e.description}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Server subscribers" description="In-process handlers registered at boot" />
            <CardBody className="p-0">
              {subs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">None registered.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {subs.map((s) => (
                    <li key={s.name} className="flex items-center justify-between px-5 py-2">
                      <span>{s.name}</span>
                      <span className="font-mono text-xs text-muted">{s.pattern}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
