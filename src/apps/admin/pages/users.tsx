import { pageContext } from "@/kernel/context";
import { listRoles, listUsers } from "@/kernel/rbac";
import { Badge, DataTable, PageHeader, statusTone, LiveRefresh } from "@/kernel/ui";
import { CreateUserDialog } from "../components/user-forms";

export default async function UsersPage() {
  const ctx = await pageContext("kernel.users.read", "/admin");
  const [users, roles] = await Promise.all([listUsers(), listRoles()]);
  const canManage = ctx.can("kernel.users.manage");

  return (
    <>
      <LiveRefresh patterns={["kernel.user.*"]} />
      <PageHeader
        title="Users"
        description="Everyone who can sign in. Roles decide what they can see and do."
        actions={canManage && <CreateUserDialog roles={roles.map((r) => ({ id: r.id, name: r.name }))} />}
      />
      <DataTable
        rows={users}
        rowKey={(u) => u.id}
        rowHref={canManage ? (u) => `/admin/users/${u.id}` : undefined}
        columns={[
          { header: "Name", cell: (u) => u.name },
          { header: "Email", cell: (u) => <span className="text-muted">{u.email}</span> },
          {
            header: "Roles",
            cell: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r.roleId} tone="primary">
                    {r.role.name}
                  </Badge>
                ))}
              </div>
            ),
          },
          { header: "Provider", cell: (u) => <span className="text-xs text-muted">{u.provider}</span> },
          { header: "Status", cell: (u) => <Badge tone={statusTone(u.status)}>{u.status}</Badge> },
        ]}
      />
    </>
  );
}
