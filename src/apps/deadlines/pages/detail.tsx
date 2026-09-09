import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { Badge, Card, CardBody, CardHeader, DescriptionList, LiveRefresh, PageHeader, RelativeTime } from "@/kernel/ui";
import { audienceFor, findVisibleDeadline, loadNames } from "../data";
import { dueInWords, stageFor } from "../reminders";
import { describeAudience } from "../visibility";
import { regionLabel } from "../regions";
import { STAGE_LABEL, type ReminderStage } from "../types";
import { urgencyTone } from "../components/deadline-table";
import { DeadlineRowActions } from "../components/row-actions";

export default async function DeadlineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageContext(undefined, `/deadlines/${id}`);
  const deadline = await findVisibleDeadline(ctx, id);
  if (!deadline) notFound();

  const [{ names }, audience] = await Promise.all([loadNames(), audienceFor(deadline)]);
  const stage = stageFor(deadline.dueAt);

  return (
    <>
      <LiveRefresh patterns={["deadlines.*"]} />
      <PageHeader
        breadcrumb={<Link href="/deadlines">Deadlines</Link>}
        title={deadline.title}
        description={deadline.description || <span className="font-mono text-xs">{deadline.reference}</span>}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={urgencyTone(deadline)}>{deadline.status === "COMPLETED" ? "MET" : (stage ?? "SCHEDULED")}</Badge>
            <DeadlineRowActions
              id={deadline.id}
              status={deadline.status}
              canComplete={ctx.can("deadlines.deadline.complete")}
              canDelete={ctx.can("deadlines.deadline.manage")}
            />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Reference", value: <span className="font-mono text-xs">{deadline.reference}</span> },
                  { label: "Category", value: <Badge tone="info">{deadline.category}</Badge> },
                  { label: "Entity", value: deadline.entity || "—" },
                  {
                    label: "Region",
                    value: <Link href={`/deadlines/map?region=${deadline.region}`}>{regionLabel(deadline.region)}</Link>,
                  },
                  { label: "Owner", value: names.users.get(deadline.ownerId) ?? "—" },
                  {
                    label: "Due",
                    value: (
                      <>
                        <RelativeTime date={deadline.dueAt} />
                        {deadline.status === "OPEN" && <span className="ml-2 text-xs text-muted">{dueInWords(deadline.dueAt)}</span>}
                      </>
                    ),
                  },
                  {
                    label: "Completed",
                    value: deadline.completedAt ? (
                      <>
                        <RelativeTime date={deadline.completedAt} /> by {names.users.get(deadline.completedById ?? "") ?? "—"}
                      </>
                    ) : (
                      "—"
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Reminders" description="Sent to the audience below at 14 / 7 / 1 days out and once overdue." />
            <CardBody>
              <DescriptionList
                items={[
                  {
                    label: "Last reminder",
                    value: deadline.lastReminderStage
                      ? `${STAGE_LABEL[deadline.lastReminderStage as ReminderStage] ?? deadline.lastReminderStage}`
                      : "None sent yet",
                  },
                  { label: "Sent", value: deadline.lastRemindedAt ? <RelativeTime date={deadline.lastRemindedAt} /> : "—" },
                ]}
              />
            </CardBody>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Audience" description={describeAudience(deadline, names)} />
            <CardBody>
              <ul className="space-y-1 text-sm">
                {audience.map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span>{a.name}</span>
                    {a.id === deadline.ownerId && <Badge tone="primary">owner</Badge>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                {audience.length} {audience.length === 1 ? "person" : "people"} can see this deadline and receive its reminders.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
