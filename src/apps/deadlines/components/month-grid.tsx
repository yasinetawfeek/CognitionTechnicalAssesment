import Link from "next/link";
import type { FinanceDeadline } from "@prisma/client";
import { cn, type Tone } from "@/kernel/ui";
import { buildMonthGrid, dayKey, WEEKDAYS, type Month } from "../calendar";
import { regionLabel } from "../regions";
import { urgencyTone } from "./deadline-table";

const chipTones: Record<Tone, string> = {
  neutral: "bg-black/5 text-fg hover:bg-black/10",
  success: "bg-success-soft text-success hover:brightness-95",
  warning: "bg-warning-soft text-warning hover:brightness-95",
  danger: "bg-danger-soft text-danger hover:brightness-95",
  info: "bg-info-soft text-info hover:brightness-95",
  primary: "bg-primary-soft text-primary hover:brightness-95",
};

const MAX_CHIPS = 3;

export function MonthGrid({ month, deadlines, today = new Date() }: { month: Month; deadlines: FinanceDeadline[]; today?: Date }) {
  const byDay = new Map<string, FinanceDeadline[]>();
  for (const deadline of deadlines) {
    const key = dayKey(deadline.dueAt);
    byDay.set(key, [...(byDay.get(key) ?? []), deadline]);
  }
  const todayKey = dayKey(today);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-black/[0.02]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted">
            {day}
          </div>
        ))}
      </div>
      {buildMonthGrid(month).map((week) => (
        <div key={week[0].key} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map((day) => {
            const items = byDay.get(day.key) ?? [];
            return (
              <div
                key={day.key}
                className={cn(
                  "min-h-24 border-r border-border p-1.5 last:border-r-0 align-top",
                  !day.inMonth && "bg-black/[0.02] text-muted",
                  day.key === todayKey && "bg-primary-soft/40",
                )}
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span className={cn("text-xs tabular-nums", day.key === todayKey ? "font-semibold text-primary" : "text-muted")}>
                    {day.date.getDate()}
                  </span>
                  {items.length > MAX_CHIPS && <span className="text-[10px] text-muted">{items.length}</span>}
                </div>
                <div className="space-y-1">
                  {items.slice(0, MAX_CHIPS).map((deadline) => (
                    <Link
                      key={deadline.id}
                      href={`/deadlines/${deadline.id}`}
                      title={`${deadline.reference} — ${deadline.title} (${regionLabel(deadline.region)})`}
                      className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium", chipTones[urgencyTone(deadline)])}
                    >
                      {deadline.title}
                    </Link>
                  ))}
                  {items.length > MAX_CHIPS && (
                    <span className="block px-1.5 text-[10px] text-muted">+{items.length - MAX_CHIPS} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
