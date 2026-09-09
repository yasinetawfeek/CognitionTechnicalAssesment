export const CATEGORIES = ["REGULATORY", "TAX", "AUDIT", "BOARD", "CLIENT", "INTERNAL"] as const;
export type DeadlineCategory = (typeof CATEGORIES)[number];

export const VISIBILITIES = ["EVERYONE", "ROLES", "USERS"] as const;
export type DeadlineVisibility = (typeof VISIBILITIES)[number];

/** Reminder stages, ordered from earliest to latest. */
export const REMINDER_STAGES = ["T14", "T7", "T1", "OVERDUE"] as const;
export type ReminderStage = (typeof REMINDER_STAGES)[number];

export const STAGE_LABEL: Record<ReminderStage, string> = {
  T14: "14 days out",
  T7: "7 days out",
  T1: "due within 24 hours",
  OVERDUE: "overdue",
};
