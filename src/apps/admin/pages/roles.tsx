import { pageContext } from "@/kernel/context";
import { listRoles } from "@/kernel/rbac";
import { Badge, DataTable, LiveRefresh, PageHeader } from "@/kernel/ui";
import { CreateRoleDialog } from "../components/role-forms";
import { editorPermissionGroups } from "../permission-groups";

export default async function RolesPage() {
  await pageContext("kernel.roles.manage", "/admin/roles");
  const roles = await listRoles();
  const groups = editorPermissionGroups();

  return (
    <>
      <LiveRefresh patterns={["kernel.role.*"]} />
      <PageHeader
        title="Roles"
        description="A role is a named bundle of permissions. Users may hold several roles; permissions are additive."
        actions={<CreateRoleDialog groups={groups} />}
      />
      <DataTable
        rows={roles}
        rowKey={(r) => r.id}
        rowHref={(r) => `/admin/roles/${r.id}`}
        columns={[
          {
            header: "Role",
            cell: (r) => (
              <div>
                <div className="font-medium">
                  {r.name} {r.isSystem && <Badge tone="neutral">system</Badge>}
                </div>
                <div className="font-mono text-xs text-muted">{r.key}</div>
              </div>
            ),
          },
          { header: "Description", cell: (r) => <span className="text-muted">{r.description}</span> },
          {
            header: "Permissions",
            cell: (r) => (
              <div className="flex max-w-md flex-wrap gap-1">
                {r.permissions.slice(0, 6).map((p) => (
                  <Badge key={p.permission}>
                    <span className="font-mono">{p.permission}</span>
                  </Badge>
                ))}
                {r.permissions.length > 6 && <Badge tone="neutral">+{r.permissions.length - 6} more</Badge>}
              </div>
            ),
          },
          { header: "Users", cell: (r) => r._count.users, className: "text-right tabular-nums" },
        ]}
      />
    </>
  );
}
