"use client";

import { Badge } from "@/kernel/ui";
import { useFlag } from "@/kernel/flags/client";
import { FLAGS, type RiskFactor } from "../types";
import { riskTone } from "../tones";

export function RiskBadge({ score, level }: { score: number | null; level: string | null }) {
  if (score === null || level === null) return <span className="text-xs text-muted">scoring…</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={riskTone(level)}>{level}</Badge>
      <span className="font-mono text-xs tabular-nums text-muted">{score.toFixed(2)}</span>
    </span>
  );
}

/**
 * Per-factor breakdown, gated by `kyc.risk-breakdown`. Toggle the flag in System → Feature flags and
 * this switches between the summary and the full explanation without a reload.
 */
export function RiskBreakdown({ score, level, factors }: { score: number | null; level: string | null; factors: RiskFactor[] }) {
  const showBreakdown = useFlag(FLAGS.riskBreakdown);
  if (score === null || level === null) {
    return <p className="text-sm text-muted">Risk scoring is running in the background — this updates automatically.</p>;
  }
  const tone = riskTone(level);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div className={tone === "danger" ? "h-full bg-danger" : tone === "warning" ? "h-full bg-warning" : "h-full bg-success"} style={{ width: `${Math.max(2, score * 100)}%` }} />
        </div>
        <RiskBadge score={score} level={level} />
      </div>
      {showBreakdown ? (
        factors.length === 0 ? (
          <p className="text-sm text-muted">No risk factors triggered.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {factors.map((f) => (
              <li key={f.factor} className="flex items-start justify-between gap-3 px-3 py-2">
                <div>
                  <span className="font-mono text-xs text-muted">{f.factor}</span>
                  <p>{f.detail}</p>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums">+{f.weight.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-xs text-muted">
          {factors.length} risk factor{factors.length === 1 ? "" : "s"} triggered. Enable <span className="font-mono">kyc.risk-breakdown</span> to see the breakdown.
        </p>
      )}
    </div>
  );
}
