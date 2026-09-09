import { REMINDER_STAGES, type ReminderStage } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The reminder stage a deadline has reached, or null if it is still further out than 14 days. */
export function stageFor(dueAt: Date, now: Date = new Date()): ReminderStage | null {
  const days = (dueAt.getTime() - now.getTime()) / DAY_MS;
  if (days < 0) return "OVERDUE";
  if (days <= 1) return "T1";
  if (days <= 7) return "T7";
  if (days <= 14) return "T14";
  return null;
}

/** Reminders only ever move forward, so each stage notifies at most once per deadline. */
export function shouldNotify(current: ReminderStage | null, lastNotified: string | null): current is ReminderStage {
  if (!current) return false;
  if (!lastNotified) return true;
  const lastIndex = REMINDER_STAGES.indexOf(lastNotified as ReminderStage);
  if (lastIndex < 0) return true;
  return REMINDER_STAGES.indexOf(current) > lastIndex;
}

export function dueInWords(dueAt: Date, now: Date = new Date()): string {
  const diff = dueAt.getTime() - now.getTime();
  const days = Math.round(Math.abs(diff) / DAY_MS);
  if (diff < 0) return days <= 1 ? "overdue since yesterday" : `overdue by ${days} days`;
  const hours = Math.round(diff / (60 * 60 * 1000));
  if (hours <= 36) return `due in ${hours} hours`;
  return `due in ${days} days`;
}
