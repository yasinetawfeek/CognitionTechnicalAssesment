/**
 * Month-grid helpers for the calendar view. All dates are local, matching how due dates are
 * entered and displayed elsewhere in the app.
 */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type CalendarDay = { date: Date; key: string; inMonth: boolean };

export type Month = { year: number; month: number };

/** Local YYYY-MM-DD, used to bucket deadlines onto days. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthKey({ year, month }: Month): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function monthLabel({ year, month }: Month): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Parses a `?month=YYYY-MM` param, falling back to the month containing `now`. */
export function parseMonth(value: string | undefined, now: Date = new Date()): Month {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return { year: now.getFullYear(), month: now.getMonth() };
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return { year: now.getFullYear(), month: now.getMonth() };
  return { year, month };
}

export function shiftMonth({ year, month }: Month, delta: number): Month {
  const shifted = new Date(year, month + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

/** Half-open [start, end) range covering the whole month. */
export function monthRange({ year, month }: Month): { start: Date; end: Date } {
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

/** Weeks of Monday-first days covering the month, padded with adjacent-month days. */
export function buildMonthGrid({ year, month }: Month): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Sunday is 0 in JS, but weeks start on Monday here.
  const start = new Date(year, month, 1 - offset);
  const weeks: CalendarDay[][] = [];

  for (let week = 0; week < 6; week++) {
    const days: CalendarDay[] = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day);
      days.push({ date, key: dayKey(date), inMonth: date.getMonth() === month });
    }
    weeks.push(days);
    const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (week + 1) * 7);
    if (next.getMonth() !== month && next > first) break;
  }
  return weeks;
}
