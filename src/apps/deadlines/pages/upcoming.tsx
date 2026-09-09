import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Alert, LiveRefresh, PageHeader, Stat } from "@/kernel/ui";
import { loadNames, visibleWhere } from "../data";
import { DAY_MS } from "../reminders";
import { DeadlineTable } from "../components/deadline-table";
import { CreateDeadlineDialog } from "../components/create-deadline";
import { RunScanButton } from "../components/run-scan";

export default async function UpcomingPage() {
  const ctx = await pageContext(undefined, "/deadlines");
  const where = { AND: [{ status: "OPEN" }, visibleWhere(ctx)] };
  const now = new Date();

  const [deadlines, { users, roles, names }, overdue, dueThisWeek] = await Promise.all([
    db.financeDeadline.findMany({ where, orderBy: { dueAt: "asc" } }),
    loadNames(),
    db.financeDeadline.count({ where: { AND: [{ status: "OPEN", dueAt: { lt: now } }, visibleWhere(ctx)] } }),
    db.financeDeadline.count({ where: { AND: [{ status: "OPEN", dueAt: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) } }, visibleWhere(ctx)] } }),
  ]);

  return (
    <>
      <LiveRefresh patterns={["deadlines.*"]} />
      <PageHeader
        title="Upcoming deadlines"
        description="Only deadlines you are in the audience for are listed here — role- and person-scoped deadlines stay hidden from everyone else."
        actions={
          <>
            {ctx.can("deadlines.reminder.run") && <RunScanButton />}
            {ctx.can("deadlines.deadline.create") && <CreateDeadlineDialog roles={roles} users={users} defaultOwnerId={ctx.user.id} />}
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open" value={deadlines.length} />
        <Stat label="Due within 7 days" value={dueThisWeek} tone={dueThisWeek > 0 ? "danger" : undefined} />
        <Stat label="Overdue" value={overdue} tone={overdue > 0 ? "danger" : undefined} />
      </div>
      {!ctx.can("deadlines.deadline.viewall") && (
        <div className="mb-4">
          <Alert tone="info">
            You are seeing the deadlines shared with everyone, with your roles, or with you personally. Holders of{" "}
            <span className="font-mono text-xs">deadlines.deadline.viewall</span> see the full calendar.
          </Alert>
        </div>
      )}
      <DeadlineTable
        deadlines={deadlines}
        names={names}
        canComplete={ctx.can("deadlines.deadline.complete")}
        canDelete={ctx.can("deadlines.deadline.manage")}
        emptyTitle="No deadlines for you"
        emptyDescription="Nothing open is shared with you right now."
      />
    </>
  );
}
