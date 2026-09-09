import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import type { BuildLogEntry } from "@/kernel/appbuilder";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, LinkButton, LiveRefresh, PageHeader, RelativeTime, cn } from "@/kernel/ui";
import { RetryBuildButton, SubmitForReviewForm } from "../components/forms";
import { requestTone, STATUS_ORDER, statusLabel } from "../status";
import type { PublishApprovalPayload } from "../types";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext(undefined, `/builder/${id}`);
  const req = await db.appRequest.findUnique({ where: { id } });
  if (!req) notFound();
  const requester = await db.user.findUnique({ where: { id: req.requestedById }, select: { name: true, email: true } });
  const approval = (await db.approvalRequest.findMany({ where: { type: "builder.app.publish" }, orderBy: { createdAt: "desc" }, select: { id: true, payload: true } })).find(
    (a) => (a.payload as PublishApprovalPayload | null)?.requestId === id,
  );

  const log = Array.isArray(req.buildLog) ? (req.buildLog as unknown as BuildLogEntry[]) : [];
  const isRequester = req.requestedById === ctx.user.id;
  const canSubmit = req.status === "READY_FOR_TESTING" && (isRequester || ctx.can("builder.request.review")) && ctx.can("builder.request.create");
  const stepIndex = STATUS_ORDER.indexOf(req.status as (typeof STATUS_ORDER)[number]);

  return (
    <>
      <LiveRefresh patterns={["apprequest.*", "app.published", "approval.*"]} />
      <PageHeader
        breadcrumb={<Link href="/builder">App requests</Link>}
        title={req.name}
        description={req.purpose}
        actions={
          <>
            <Badge tone={requestTone(req.status)}>{statusLabel(req.status)}</Badge>
            {req.previewUrl && req.status !== "REJECTED" && (
              <LinkButton href={req.previewUrl} variant="secondary" size="sm">
                Open preview
              </LinkButton>
            )}
          </>
        }
      />

      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {STATUS_ORDER.map((s, i) => (
          <li
            key={s}
            className={cn(
              "rounded-full border px-3 py-1",
              i < stepIndex && "border-success/40 bg-success-soft text-success",
              i === stepIndex && "border-primary bg-primary text-white",
              i > stepIndex && "border-border text-muted",
            )}
          >
            {i + 1}. {statusLabel(s)}
          </li>
        ))}
        {(req.status === "REJECTED" || req.status === "FAILED") && (
          <li className="rounded-full border border-danger/40 bg-danger-soft px-3 py-1 text-danger">{statusLabel(req.status)}</li>
        )}
      </ol>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Build log" description={req.sessionUrl ? <a href={req.sessionUrl} target="_blank" rel="noreferrer" className="hover:underline">{req.sessionUrl}</a> : "Waiting for the agent to pick this up…"} />
            <CardBody>
              {log.length === 0 ? (
                <p className="text-sm text-muted">Queued. The background worker starts the build within a couple of seconds.</p>
              ) : (
                <ol className="space-y-2 font-mono text-xs">
                  {log.map((e, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="shrink-0 text-muted">{e.at.slice(11, 19)}</span>
                      <span>
                        <span className="font-medium">{e.step}</span>
                        {e.detail && <span className="text-muted"> — {e.detail}</span>}
                      </span>
                    </li>
                  ))}
                  {req.status === "BUILDING" && <li className="animate-pulse text-muted">working…</li>}
                </ol>
              )}
            </CardBody>
          </Card>

          {req.status === "READY_FOR_TESTING" && (
            <Card>
              <CardHeader title="Test, then send for review" description="Open the preview, try the flows you asked for, and hand it to an admin. Approval merges the branch and publishes the app." />
              <CardBody>
                {canSubmit ? <SubmitForReviewForm id={req.id} /> : <Alert tone="info">Only the requester (or a reviewer) can send this for review.</Alert>}
              </CardBody>
            </Card>
          )}
          {req.status === "IN_REVIEW" && (
            <Alert tone="warning" title="Waiting for an admin">
              {approval ? (
                <Link href={`/approvals/${approval.id}`} className="underline">
                  Open the approval request
                </Link>
              ) : (
                "An approval request has been raised."
              )}
            </Alert>
          )}
          {req.status === "PUBLISHED" && (
            <Alert tone="success" title="Published">
              Merged to main{req.publishedAt && <> <RelativeTime date={req.publishedAt} /></>}. Roll it out by granting <span className="font-mono">{req.appId}.access</span> to a role in{" "}
              <Link href="/admin/roles" className="underline">Admin → Roles</Link>.
              {req.reviewNote && <p className="mt-1 text-muted">Reviewer: {req.reviewNote}</p>}
            </Alert>
          )}
          {(req.status === "REJECTED" || req.status === "FAILED") && (
            <Alert tone="danger" title={req.status === "REJECTED" ? "Rejected by reviewer" : "Build failed"}>
              <div className="flex items-start justify-between gap-4">
                <span>{req.reviewNote ?? log.at(-1)?.detail ?? "No details"}</span>
                {ctx.can("builder.request.create") && <RetryBuildButton id={req.id} />}
              </div>
            </Alert>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Request" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "App id", value: <span className="font-mono">/{req.appId}</span> },
                  { label: "Requested by", value: requester ? `${requester.name} (${requester.email})` : "?" },
                  { label: "Created", value: <RelativeTime date={req.createdAt} /> },
                  { label: "Branch", value: req.branch ? <span className="font-mono">{req.branch}</span> : "—" },
                  { label: "Pull request", value: req.prUrl ? <a href={req.prUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{req.prUrl.replace(/^https?:\/\//, "")}</a> : "—" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Requirements" description="This is what the agent was given, alongside AGENTS.md and the authoring guide." />
            <CardBody>
              <pre className="whitespace-pre-wrap text-sm">{req.requirements}</pre>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
