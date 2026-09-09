import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { LiveRefresh, PageHeader } from "@/kernel/ui";
import { loadNames, visibleWhere } from "../data";
import { DeadlineTable } from "../components/deadline-table";

export default async function CompletedPage() {
  const ctx = await pageContext(undefined, "/deadlines/completed");
  const [deadlines, { names }] = await Promise.all([
    db.financeDeadline.findMany({ where: { AND: [{ status: "COMPLETED" }, visibleWhere(ctx)] }, orderBy: { completedAt: "desc" } }),
    loadNames(),
  ]);

  return (
    <>
      <LiveRefresh patterns={["deadlines.*"]} />
      <PageHeader title="Completed" description="Deadlines already met, filtered by the same visibility rules." />
      <DeadlineTable
        deadlines={deadlines}
        names={names}
        canComplete={false}
        canDelete={ctx.can("deadlines.deadline.manage")}
        emptyTitle="Nothing completed yet"
        emptyDescription="Deadlines you mark as met appear here."
      />
    </>
  );
}
