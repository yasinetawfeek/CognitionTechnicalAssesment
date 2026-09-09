import Link from "next/link";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { evaluateAll } from "@/kernel/flags";
import { installedAppIds, isKernelSurface } from "@/kernel/apps/installs";
import { visibleAppsFor } from "@/kernel/ui/shell/shell";
import { Badge, buttonClass, Card, CardBody, CardHeader, EmptyState, Icon, LiveRefresh, PageHeader, RelativeTime, Stat } from "@/kernel/ui";

export default async function HomePage() {
  const ctx = await pageContext();
  const flagState = await evaluateAll(ctx.user);
  const [visible, installed] = await Promise.all([visibleAppsFor(ctx.user.permissions, flagState), installedAppIds(ctx.user.id)]);
  const myApps = visible.filter((a) => !isKernelSurface(a) && installed.includes(a.id));
  const installable = visible.filter((a) => !isKernelSurface(a)).length;
  const platform = visible.filter((a) => isKernelSurface(a) && a.id !== "apps");
  const [pendingApprovals, unreadNotifications, recentAudit, recentEvents, failedJobs] = await Promise.all([
    db.approvalRequest.count({ where: { status: "PENDING", requestedById: { not: ctx.user.id }, requiredPermission: { in: ctx.user.permissions } } }),
    db.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
    db.auditLog.findMany({ orderBy: { seq: "desc" }, take: 8 }),
    db.event.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.job.count({ where: { status: "FAILED" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <LiveRefresh patterns={["*"]} />
      <PageHeader
        title={`Welcome, ${ctx.user.name.split(" ")[0]}`}
        description={`Signed in as ${ctx.user.email} · ${ctx.user.roles.map((r) => r.name).join(", ") || "no roles"}`}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="My apps" value={myApps.length} hint={<Link href="/apps/store" className="underline">{installable - myApps.length} more in the App Store</Link>} />
        <Stat label="Approvals waiting for you" value={pendingApprovals} tone={pendingApprovals ? "warning" : undefined} hint={<Link href="/approvals" className="underline">Open inbox</Link>} />
        <Stat label="Unread notifications" value={unreadNotifications} />
        <Stat label="Failed jobs" value={failedJobs} tone={failedJobs ? "danger" : undefined} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">My apps</h2>
          <Link href="/apps" className="text-xs underline">
            Manage apps
          </Link>
        </div>
        {myApps.length === 0 ? (
          <EmptyState
            title="No apps installed"
            description="Browse the App Store to add the tools you work with."
            action={
              <Link href="/apps/store" className={buttonClass("primary", "sm")}>
                Open the App Store
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myApps.map((a) => (
              <AppTile key={a.id} app={a} />
            ))}
          </div>
        )}
      </section>

      {platform.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Platform</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platform.map((a) => (
              <AppTile key={a.id} app={a} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent audit entries" actions={<Link href="/audit" className="text-xs underline">View all</Link>} />
          <CardBody>
            {recentAudit.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
            <ul className="divide-y divide-border text-sm">
              {recentAudit.map((a) => (
                <li key={a.seq} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate">
                    <Badge>{a.appId}</Badge> <span className="font-mono text-xs">{a.action}</span>
                    <span className="text-muted"> by {a.actorEmail}</span>
                  </span>
                  <RelativeTime date={a.ts} className="shrink-0 text-xs text-muted" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent events" actions={<Link href="/system" className="text-xs underline">Event stream</Link>} />
          <CardBody>
            {recentEvents.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
            <ul className="divide-y divide-border text-sm">
              {recentEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate">
                    <span className="font-mono text-xs">{e.type}</span>
                    <span className="text-muted"> from {e.sourceAppId}</span>
                  </span>
                  <RelativeTime date={e.createdAt} className="shrink-0 text-xs text-muted" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AppTile({ app }: { app: { id: string; name: string; description: string; icon: string } }) {
  return (
    <Link href={`/${app.id}`} className="group">
      <Card className="h-full transition group-hover:border-primary">
        <CardBody>
          <div className="mb-2 flex items-center gap-2">
            <Icon name={app.icon} className="h-5 w-5 text-primary" />
            <span className="font-medium">{app.name}</span>
          </div>
          <p className="text-sm text-muted">{app.description}</p>
        </CardBody>
      </Card>
    </Link>
  );
}
