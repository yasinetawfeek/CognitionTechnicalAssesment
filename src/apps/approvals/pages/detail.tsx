import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, JsonView, PageHeader, RelativeTime, statusTone } from "@/kernel/ui";
import { DecisionForm } from "../components/decision-form";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext("kernel.approvals.read", `/approvals/${id}`);
  const req = await db.approvalRequest.findUnique({
    where: { id },
    include: { requestedBy: { select: { id: true, name: true, email: true } }, decidedBy: { select: { name: true, email: true } } },
  });
  if (!req) notFound();

  const isRequester = req.requestedById === ctx.user.id;
  const canDecide = req.status === "PENDING" && !isRequester && ctx.can(req.requiredPermission);

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/approvals">Approvals</Link>}
        title={req.title}
        description={req.description || <span className="font-mono">{req.type}</span>}
        actions={<Badge tone={statusTone(req.status)}>{req.status}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Proposed change" description="Payload the requesting app will apply if approved." />
            <CardBody>
              <JsonView value={req.payload} />
            </CardBody>
          </Card>
          {req.status === "PENDING" && (
            <Card>
              <CardHeader title="Decision" />
              <CardBody>
                {canDecide ? (
                  <DecisionForm id={req.id} />
                ) : isRequester ? (
                  <Alert tone="info" title="Waiting for a second reviewer">
                    Four-eyes rule: you opened this request so you can&apos;t decide it. You may cancel it below.
                    <div className="mt-3">
                      <DecisionForm id={req.id} cancelOnly />
                    </div>
                  </Alert>
                ) : (
                  <Alert tone="warning" title="You can't decide this request">
                    Deciding requires <span className="font-mono text-xs">{req.requiredPermission}</span>.
                  </Alert>
                )}
              </CardBody>
            </Card>
          )}
          {req.status !== "PENDING" && (
            <Alert tone={req.status === "APPROVED" ? "success" : req.status === "REJECTED" ? "danger" : "neutral"} title={`${req.status} ${req.decidedBy ? `by ${req.decidedBy.name}` : ""}`}>
              {req.decisionNote ? <em>&ldquo;{req.decisionNote}&rdquo;</em> : "No note left."}
            </Alert>
          )}
        </div>
        <Card className="self-start lg:col-span-2">
          <CardHeader title="Details" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "App", value: <Badge tone="primary">{req.appId}</Badge> },
                { label: "Type", value: <span className="font-mono text-xs">{req.type}</span> },
                { label: "Requires", value: <span className="font-mono text-xs">{req.requiredPermission}</span> },
                { label: "Requested by", value: `${req.requestedBy.name} (${req.requestedBy.email})` },
                { label: "Opened", value: <RelativeTime date={req.createdAt} /> },
                { label: "Decided", value: req.decidedAt ? <RelativeTime date={req.decidedAt} /> : "—" },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
