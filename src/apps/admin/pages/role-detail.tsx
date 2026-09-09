import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { getRole } from "@/kernel/rbac";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/kernel/ui";
import { EditRoleForm } from "../components/role-forms";
import { editorPermissionGroups } from "../permission-groups";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageContext("kernel.roles.manage", `/admin/roles/${id}`);
  const role = await getRole(id).catch(() => null);
  if (!role) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/admin/roles">Roles</Link>}
        title={role.name}
        description={<span className="font-mono">{role.key}</span>}
        actions={role.isSystem && <Badge>system role</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Permissions" description="Changes take effect on the user's next request." />
          <CardBody>
            <EditRoleForm
              role={{
                id: role.id,
                key: role.key,
                name: role.name,
                description: role.description,
                isSystem: role.isSystem,
                permissions: role.permissions.map((p) => p.permission),
                userCount: role.users.length,
              }}
              groups={editorPermissionGroups()}
            />
          </CardBody>
        </Card>
        <Card className="self-start lg:col-span-2">
          <CardHeader title={`Members (${role.users.length})`} />
          <CardBody className="p-0">
            {role.users.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Nobody holds this role.</p>
            ) : (
              <ul className="divide-y divide-border">
                {role.users.map((u) => (
                  <li key={u.userId} className="px-5 py-2 text-sm">
                    <Link href={`/admin/users/${u.userId}`} className="text-primary hover:underline">
                      {u.user.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted">{u.user.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
