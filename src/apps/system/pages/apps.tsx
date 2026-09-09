import { pageContext } from "@/kernel/context";
import { appPermissions, listApps } from "@/kernel/apps/registry";
import { appAccessPermission } from "@/kernel/rbac/permissions";
import { listFlags } from "@/kernel/flags";
import { Badge, Card, CardBody, CardHeader, Icon, PageHeader } from "@/kernel/ui";

export default async function AppsPage() {
  const ctx = await pageContext(undefined, "/system/apps");
  const apps = listApps();
  const flags = await listFlags();

  return (
    <>
      <PageHeader
        title="App registry"
        description="Everything registered in src/apps/index.ts. Each app is a manifest plus routes under src/app/(shell)/<id>. Run `npm run create-app <id>` to add one."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {apps.map((app) => {
          const flag = app.featureFlag ? flags.find((f) => f.key === app.featureFlag) : undefined;
          const hasAccess = ctx.can(appAccessPermission(app.id));
          return (
            <Card key={app.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Icon name={app.icon} className="h-4 w-4 text-primary" />
                    {app.name}
                    <span className="font-mono text-xs text-muted">/{app.id}</span>
                  </span>
                }
                description={app.description}
                actions={
                  <div className="flex gap-1">
                    <Badge tone="neutral">{app.category}</Badge>
                    {app.hidden && <Badge>hidden</Badge>}
                    <Badge tone={hasAccess ? "success" : "neutral"}>{hasAccess ? "you have access" : "no access"}</Badge>
                  </div>
                }
              />
              <CardBody className="space-y-3 text-sm">
                {app.featureFlag && (
                  <p className="text-xs text-muted">
                    Gated by flag <span className="font-mono">{app.featureFlag}</span> — currently {flag?.enabled ? "ON" : "OFF"}
                  </p>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {appPermissions(app).map((p) => (
                      <Badge key={p.key} tone={ctx.can(p.key) ? "primary" : "neutral"}>
                        <span className="font-mono" title={p.description}>
                          {p.key}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
                {app.events?.length ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Publishes</p>
                    <div className="flex flex-wrap gap-1">
                      {app.events.map((e) => (
                        <Badge key={e.type}>
                          <span className="font-mono" title={e.description}>
                            {e.type}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {app.nav?.length ? (
                  <p className="text-xs text-muted">
                    Nav: {app.nav.map((n) => n.label).join(" · ")}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
