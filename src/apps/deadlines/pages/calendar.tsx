import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Badge, LinkButton, LiveRefresh, PageHeader } from "@/kernel/ui";
import { monthKey, monthLabel, monthRange, parseMonth, shiftMonth } from "../calendar";
import { visibleWhere } from "../data";
import { MonthGrid } from "../components/month-grid";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const ctx = await pageContext(undefined, "/deadlines/calendar");
  const month = parseMonth(monthParam);
  const { start, end } = monthRange(month);

  // Adjacent-month days are rendered in the grid, so fetch a week of padding on both sides.
  const padding = 7 * 24 * 60 * 60 * 1000;
  const deadlines = await db.financeDeadline.findMany({
    where: {
      AND: [{ dueAt: { gte: new Date(start.getTime() - padding), lt: new Date(end.getTime() + padding) } }, visibleWhere(ctx)],
    },
    orderBy: { dueAt: "asc" },
  });
  const inMonth = deadlines.filter((d) => d.dueAt >= start && d.dueAt < end);

  return (
    <>
      <LiveRefresh patterns={["deadlines.*"]} />
      <PageHeader
        title="Calendar"
        description="Every deadline you are in the audience for, on the day it falls due. Colours follow how close the deadline is."
        actions={
          <div className="flex items-center gap-2">
            <LinkButton variant="ghost" href={`/deadlines/calendar?month=${monthKey(shiftMonth(month, -1))}`}>
              Previous
            </LinkButton>
            <LinkButton variant="ghost" href="/deadlines/calendar">
              Today
            </LinkButton>
            <LinkButton variant="ghost" href={`/deadlines/calendar?month=${monthKey(shiftMonth(month, 1))}`}>
              Next
            </LinkButton>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{monthLabel(month)}</h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>
            {inMonth.length} {inMonth.length === 1 ? "deadline" : "deadlines"} this month
          </span>
          <span className="flex items-center gap-1.5">
            <Badge tone="danger">Overdue</Badge>
            <Badge tone="warning">Within 7 days</Badge>
            <Badge tone="neutral">Scheduled</Badge>
            <Badge tone="success">Met</Badge>
          </span>
        </div>
      </div>
      <MonthGrid month={month} deadlines={deadlines} />
    </>
  );
}
