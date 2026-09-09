import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Badge, Card, CardBody, CardHeader, DescriptionList, JsonView, PageHeader } from "@/kernel/ui";

export default async function AuditEntryPage({ params }: { params: Promise<{ seq: string }> }) {
  const { seq } = await params;
  await pageContext("kernel.audit.read", `/audit/${seq}`);
  const n = Number(seq);
  if (!Number.isInteger(n)) notFound();
  const row = await db.auditLog.findUnique({ where: { seq: n } });
  if (!row) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/audit">Audit log</Link>}
        title={
          <span>
            #{row.seq} <span className="font-mono text-base">{row.action}</span>
          </span>
        }
        description={`${row.actorEmail} · ${row.ts.toLocaleString()}`}
        actions={<Badge tone="primary">{row.appId}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Entry" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Target", value: `${row.targetType}${row.targetId ? ` · ${row.targetId}` : ""}` },
                { label: "IP", value: row.ip ?? "—" },
                { label: "Previous hash", value: <span className="break-all font-mono text-xs">{row.prevHash}</span> },
                { label: "Hash", value: <span className="break-all font-mono text-xs">{row.hash}</span> },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Metadata" />
          <CardBody>
            <JsonView value={row.metadata ?? {}} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Before" />
          <CardBody>
            <JsonView value={row.before ?? null} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="After" />
          <CardBody>
            <JsonView value={row.after ?? null} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
