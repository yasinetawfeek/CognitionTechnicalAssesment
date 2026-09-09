import { pageContext } from "@/kernel/context";
import { listPermissionGroups } from "@/kernel/apps/registry";
import { listRoles } from "@/kernel/rbac";
import { hasPermission } from "@/kernel/rbac/permissions";
import { Card, CardBody, CardHeader, Icon, PageHeader } from "@/kernel/ui";

/** Matrix of every declared permission × every role, with wildcard resolution. */
export default async function PermissionsPage() {
  await pageContext("kernel.users.read", "/admin/permissions");
  const roles = await listRoles();
  const groups = listPermissionGroups();

  return (
    <>
      <PageHeader
        title="Permission matrix"
        description="Every permission declared by the kernel and installed apps, resolved against each role (wildcards expanded)."
      />
      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g.appId}>
            <CardHeader title={g.name} description={<span className="font-mono text-xs">{g.appId}.*</span>} />
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2 font-medium">Permission</th>
                    {roles.map((r) => (
                      <th key={r.id} className="px-3 py-2 text-center font-medium">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {g.permissions.map((p) => (
                    <tr key={p.key}>
                      <td className="px-5 py-2">
                        <div className="font-mono text-xs">{p.key}</div>
                        <div className="text-xs text-muted">{p.description}</div>
                      </td>
                      {roles.map((r) => {
                        const granted = hasPermission(
                          r.permissions.map((x) => x.permission),
                          p.key,
                        );
                        return (
                          <td key={r.id} className="px-3 py-2 text-center">
                            {granted ? <Icon name="Check" className="mx-auto h-4 w-4 text-success" /> : <span className="text-border">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
