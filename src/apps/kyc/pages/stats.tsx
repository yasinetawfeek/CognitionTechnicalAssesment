import { pageContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { Badge, Card, CardBody, CardHeader, LiveRefresh, PageHeader, Stat } from "@/kernel/ui";
import { CASE_STATUSES, OPEN_STATUSES, RISK_LEVELS } from "../types";
import { caseStatusTone, riskTone } from "../tones";

const DAY = 24 * 3600 * 1000;

export default async function StatsPage() {
  await pageContext("kyc.case.read", "/kyc/stats");
  const since = new Date(Date.now() - 7 * DAY);

  const [byStatus, byRisk, decidedLast7, oldestOpen, decidedCases, byCountry] = await Promise.all([
    db.kycCase.groupBy({ by: ["status"], _count: { _all: true } }),
    db.kycCase.groupBy({ by: ["riskLevel"], _count: { _all: true } }),
    db.kycCase.count({ where: { decidedAt: { gte: since } } }),
    db.kycCase.findFirst({ where: { status: { in: OPEN_STATUSES } }, orderBy: { submittedAt: "asc" }, select: { submittedAt: true, reference: true } }),
    db.kycCase.findMany({ where: { decidedAt: { not: null } }, select: { submittedAt: true, decidedAt: true, decision: true, decidedById: true, riskLevel: true } }),
    db.kycCase.groupBy({ by: ["country"], _count: { _all: true }, orderBy: { _count: { country: "desc" } }, take: 8 }),
  ]);

  const statusCounts = new Map(byStatus.map((r) => [r.status, r._count._all]));
  const riskCounts = new Map(byRisk.map((r) => [r.riskLevel, r._count._all]));
  const statusCount = (s: string) => statusCounts.get(s) ?? 0;
  const riskCount = (l: string | null) => riskCounts.get(l) ?? 0;
  const total = byStatus.reduce((a, r) => a + r._count._all, 0);
  const open = OPEN_STATUSES.reduce((a, s) => a + statusCount(s), 0);

  const approved = decidedCases.filter((c) => c.decision === "APPROVE").length;
  const approvalRate = decidedCases.length ? Math.round((approved / decidedCases.length) * 100) : null;
  const autoDecided = decidedCases.filter((c) => c.decidedById === null).length;
  const avgHours = decidedCases.length
    ? decidedCases.reduce((a, c) => a + ((c.decidedAt ?? c.submittedAt).getTime() - c.submittedAt.getTime()), 0) / decidedCases.length / 3600000
    : null;
  const oldestAgeDays = oldestOpen ? Math.floor((Date.now() - oldestOpen.submittedAt.getTime()) / DAY) : null;

  return (
    <>
      <LiveRefresh patterns={["kyc.*"]} />
      <PageHeader title="Stats" description="Throughput and risk mix. Live — updates as cases move." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open cases" value={open} hint={`${total} total`} />
        <Stat label="Decided (7d)" value={decidedLast7} hint={autoDecided ? `${autoDecided} auto-approved all-time` : undefined} />
        <Stat label="Approval rate" value={approvalRate === null ? "—" : `${approvalRate}%`} hint={`${decidedCases.length} decisions`} />
        <Stat label="Avg time to decision" value={avgHours === null ? "—" : avgHours < 48 ? `${avgHours.toFixed(1)}h` : `${(avgHours / 24).toFixed(1)}d`} hint={oldestOpen ? `Oldest open: ${oldestOpen.reference} (${oldestAgeDays}d)` : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="By status" />
          <CardBody className="p-0">
            <ul className="divide-y divide-border text-sm">
              {CASE_STATUSES.map((s) => (
                <li key={s} className="flex items-center justify-between px-5 py-2.5">
                  <Badge tone={caseStatusTone(s)}>{s.replace("_", " ")}</Badge>
                  <span className="tabular-nums">{statusCount(s)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By risk level" description="Open and closed cases." />
          <CardBody className="p-0">
            <ul className="divide-y divide-border text-sm">
              {RISK_LEVELS.map((l) => (
                <li key={l} className="flex items-center justify-between px-5 py-2.5">
                  <Badge tone={riskTone(l)}>{l}</Badge>
                  <span className="tabular-nums">{riskCount(l)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between px-5 py-2.5">
                <Badge>UNSCORED</Badge>
                <span className="tabular-nums">{riskCount(null)}</span>
              </li>
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top countries" />
          <CardBody className="p-0">
            <ul className="divide-y divide-border text-sm">
              {byCountry.map((c) => (
                <li key={c.country} className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-mono">{c.country}</span>
                  <span className="tabular-nums">{c._count._all}</span>
                </li>
              ))}
              {byCountry.length === 0 && <li className="px-5 py-4 text-muted">No cases yet.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
