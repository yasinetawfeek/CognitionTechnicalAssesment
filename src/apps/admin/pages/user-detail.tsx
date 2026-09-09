import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { getUser, listRoles } from "@/kernel/rbac";
import { db } from "@/kernel/db";
import { Card, CardBody, CardHeader, DescriptionList, PageHeader, RelativeTime, Badge, statusTone } from "@/kernel/ui";
import { EditUserForm } from "../components/user-forms";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageContext("kernel.users.manage", `/admin/users/${id}`);
  const [user, roles, recent, lastSession] = await Promise.all([
    getUser(id).catch(() => null),
    listRoles(),
    db.auditLog.findMany({ where: { actorId: id }, orderBy: { seq: "desc" }, take: 10 }),
    db.session.findFirst({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!user) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/admin">Users</Link>}
        title={user.name}
        description={user.email}
        actions={<Badge tone={statusTone(user.status)}>{user.status}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Profile & access" />
          <CardBody>
            <EditUserForm
              user={{ id: user.id, name: user.name, email: user.email, status: user.status, roleIds: user.roles.map((r) => r.roleId) }}
              roles={roles.map((r) => ({ id: r.id, name: r.name }))}
            />
          </CardBody>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Provider", value: user.provider },
                  { label: "Created", value: <RelativeTime date={user.createdAt} /> },
                  { label: "Last login", value: lastSession ? <RelativeTime date={lastSession.createdAt} /> : "never" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent activity" actions={<Link href={`/audit?actor=${encodeURIComponent(user.email)}`} className="text-xs text-primary">View all</Link>} />
            <CardBody className="p-0">
              {recent.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No activity yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((a) => (
                    <li key={a.seq} className="flex items-center justify-between px-5 py-2 text-sm">
                      <span className="font-mono text-xs">{a.action}</span>
                      <RelativeTime date={a.ts} className="text-xs text-muted" />
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
