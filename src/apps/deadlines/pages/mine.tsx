import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { LiveRefresh, PageHeader } from "@/kernel/ui";
import { loadNames } from "../data";
import { DeadlineTable } from "../components/deadline-table";

export default async function MyDeadlinesPage() {
  const ctx = await pageContext(undefined, "/deadlines/mine");
  const [deadlines, { names }] = await Promise.all([
    db.financeDeadline.findMany({
      where: { OR: [{ ownerId: ctx.user.id }, { visibility: "USERS", visibleUsers: { contains: `|${ctx.user.id}|` } }] },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    }),
    loadNames(),
  ]);

  return (
    <>
      <LiveRefresh patterns={["deadlines.*"]} />
      <PageHeader title="My deadlines" description="Deadlines you own, plus the ones shared with you personally." />
      <DeadlineTable
        deadlines={deadlines}
        names={names}
        canComplete={ctx.can("deadlines.deadline.complete")}
        canDelete={ctx.can("deadlines.deadline.manage")}
        emptyTitle="Nothing assigned to you"
        emptyDescription="You are not the owner of any deadline and none are shared with you by name."
      />
    </>
  );
}
