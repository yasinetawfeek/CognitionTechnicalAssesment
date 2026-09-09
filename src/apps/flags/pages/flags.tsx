import { pageContext } from "@/kernel/context";
import { listFlags, type FlagRules } from "@/kernel/flags";
import { listRoles } from "@/kernel/rbac";
import { getApp } from "@/kernel/apps/registry";
import { Badge, DataTable, EmptyState, LiveRefresh, PageHeader, RelativeTime } from "@/kernel/ui";
import { FlagDialog, FlagToggle } from "../components/flags";

export default async function FlagsPage() {
  const ctx = await pageContext("kernel.flags.read", "/flags");
  const [flags, roles] = await Promise.all([listFlags(), listRoles()]);
  const canManage = ctx.can("kernel.flags.manage");
  const roleKeys = roles.map((r) => r.key);
  const groups = Array.from(
    flags.reduce((m, f) => m.set(f.ownerAppId, [...(m.get(f.ownerAppId) ?? []), f]), new Map<string, typeof flags>()),
  ).sort(([a], [b]) => (a === "kernel" ? -1 : b === "kernel" ? 1 : a.localeCompare(b)));

  return (
    <>
      <LiveRefresh patterns={["flag.*"]} />
      <PageHeader
        title="Feature flags"
        description="Platform-wide flag service. Toggling publishes flag.updated; every open app re-evaluates its flags within a second, no reload."
        actions={canManage && <FlagDialog roleKeys={roleKeys} />}
      />
      {groups.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No flags yet" description="Create one here, or let an app create its own with an ownerAppId." />
        </div>
      )}
      {groups.map(([ownerAppId, rows]) => (
      <div key={ownerAppId} className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          {getApp(ownerAppId)?.name ?? (ownerAppId === "kernel" ? "Kernel" : ownerAppId)}
          <Badge tone="neutral">{rows.length}</Badge>
        </h2>
        <DataTable
          rows={rows}
          rowKey={(f) => f.key}
          emptyTitle="No flags yet"
          columns={[
            {
              header: "Flag",
              cell: (f) => (
                <div>
                  <div className="font-mono text-sm">{f.key}</div>
                  <div className="text-xs text-muted">{f.description}</div>
                </div>
              ),
            },
            { header: "Targeting", cell: (f) => <Rules rules={f.rules as FlagRules | null} /> },
            { header: "Updated", cell: (f) => <RelativeTime date={f.updatedAt} className="text-muted" /> },
            {
              header: "State",
              align: "right",
              cell: (f) => (
                <div className="flex items-center justify-end gap-2">
                  {canManage ? (
                    <>
                      <FlagDialog
                        roleKeys={roleKeys}
                        flag={{ key: f.key, description: f.description, enabled: f.enabled, ownerAppId: f.ownerAppId, rules: f.rules as FlagRules | null }}
                      />
                      <FlagToggle flagKey={f.key} enabled={f.enabled} />
                    </>
                  ) : (
                    <Badge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? "ON" : "OFF"}</Badge>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
      ))}
    </>
  );
}

function Rules({ rules }: { rules: FlagRules | null }) {
  if (!rules || Object.keys(rules).length === 0) return <span className="text-xs text-muted">everyone</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {rules.roles?.length ? <Badge tone="info">roles: {rules.roles.join(", ")}</Badge> : null}
      {rules.users?.length ? <Badge tone="info">{rules.users.length} user{rules.users.length === 1 ? "" : "s"}</Badge> : null}
      {rules.percentage !== undefined ? <Badge tone="warning">{rules.percentage}% rollout</Badge> : null}
    </div>
  );
}
