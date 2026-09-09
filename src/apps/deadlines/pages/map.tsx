import type { FinanceDeadline } from "@prisma/client";
import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Alert, LiveRefresh, PageHeader, type Tone } from "@/kernel/ui";
import { loadNames, visibleWhere } from "../data";
import { REGIONS, regionLabel } from "../regions";
import { stageFor } from "../reminders";
import { DeadlineTable } from "../components/deadline-table";
import { RegionMap, type RegionSummary } from "../components/region-map";

/** A region is coloured by its most pressing open deadline. */
function summarise(key: string, deadlines: FinanceDeadline[]): RegionSummary {
  const stages = deadlines.map((d) => stageFor(d.dueAt));
  const overdue = stages.filter((s) => s === "OVERDUE").length;
  const dueSoon = stages.filter((s) => s === "T1" || s === "T7").length;
  const tone: Tone = overdue > 0 ? "danger" : dueSoon > 0 ? "warning" : "info";
  return { key, total: deadlines.length, overdue, dueSoon, tone };
}

export default async function MapPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region: regionParam } = await searchParams;
  const ctx = await pageContext(undefined, "/deadlines/map");
  const selected = REGIONS.some((r) => r.key === regionParam) ? regionParam : undefined;

  const [deadlines, { names }] = await Promise.all([
    db.financeDeadline.findMany({ where: { AND: [{ status: "OPEN" }, visibleWhere(ctx)] }, orderBy: { dueAt: "asc" } }),
    loadNames(),
  ]);

  const byRegion = new Map<string, FinanceDeadline[]>();
  for (const deadline of deadlines) {
    byRegion.set(deadline.region, [...(byRegion.get(deadline.region) ?? []), deadline]);
  }
  const summaries = [...byRegion].map(([key, items]) => summarise(key, items));
  const listed = selected ? (byRegion.get(selected) ?? []) : deadlines;

  return (
    <>
      <LiveRefresh patterns={["deadlines.*"]} />
      <PageHeader
        title="Regions"
        description="Where your open deadlines land. Pick a country or region to filter the list — jurisdictions with nothing shared with you stay grey."
      />
      <div className="mb-6">
        <RegionMap summaries={summaries} selected={selected} />
      </div>
      {selected && (
        <div className="mb-4">
          <Alert tone="info">
            Showing {listed.length} open {listed.length === 1 ? "deadline" : "deadlines"} for {regionLabel(selected)}. Select the region
            again to clear the filter.
          </Alert>
        </div>
      )}
      <DeadlineTable
        deadlines={listed}
        names={names}
        canComplete={ctx.can("deadlines.deadline.complete")}
        canDelete={ctx.can("deadlines.deadline.manage")}
        emptyTitle={selected ? `Nothing open in ${regionLabel(selected)}` : "No deadlines for you"}
        emptyDescription="Nothing open is shared with you in this jurisdiction."
      />
    </>
  );
}
