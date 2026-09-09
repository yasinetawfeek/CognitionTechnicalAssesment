import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Alert, Badge, Card, CardBody, CardHeader, DataTable, PageHeader, Stat } from "@/kernel/ui";

/**
 * Mock preview. With a real adapter this would be the PR's preview deployment (e.g. Vercel) opened in
 * a new tab; for the PoC we render a stub of the requested app inside the shell so the
 * "test → send for review" step is demonstrable end to end.
 */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pageContext(undefined, `/builder/${id}/preview`);
  const req = await db.appRequest.findUnique({ where: { id } });
  if (!req || !req.previewUrl) notFound();

  const bullets = req.requirements
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
  const rows = bullets.slice(0, 6).map((b, i) => ({ id: `${i}`, title: b, status: ["DRAFT", "PENDING_APPROVAL", "APPROVED"][i % 3] }));

  return (
    <>
      <Alert tone="warning" title="Preview build — not published">
        Branch <span className="font-mono">{req.branch}</span> · <a href={req.prUrl ?? "#"} target="_blank" rel="noreferrer" className="underline">pull request</a> ·{" "}
        <Link href={`/builder/${req.id}`} className="underline">
          back to request
        </Link>
        . In production this would be the PR&apos;s preview deployment.
      </Alert>
      <div className="mt-6">
        <PageHeader title={req.name} description={req.purpose} actions={<Badge tone="info">/{req.appId}</Badge>} />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open items" value={rows.length} />
        <Stat label="Awaiting approval" value={rows.filter((r) => r.status === "PENDING_APPROVAL").length} tone="warning" />
        <Stat label="Approved today" value={rows.filter((r) => r.status === "APPROVED").length} tone="success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            emptyTitle="No data"
            columns={[
              { header: "Item", cell: (r) => <span className="font-medium">{r.title}</span> },
              { header: "Status", cell: (r) => <Badge tone={r.status === "APPROVED" ? "success" : r.status === "PENDING_APPROVAL" ? "warning" : "info"}>{r.status.replace("_", " ")}</Badge> },
            ]}
          />
        </div>
        <Card>
          <CardHeader title="Generated from your requirements" />
          <CardBody>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Permissions declared: <span className="font-mono">{req.appId}.access</span>, <span className="font-mono">{req.appId}.item.create</span>, <span className="font-mono">{req.appId}.item.approve</span>
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
