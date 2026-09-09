import { defineApp } from "@/kernel/apps/types";

export const deadlinesApp = defineApp({
  id: "deadlines",
  name: "Financial Deadlines",
  description: "Tracks regulatory, tax and audit deadlines and reminds their audience before they land",
  icon: "CalendarClock",
  category: "finance",
  permissions: [
    { key: "deadlines.deadline.create", description: "Create deadlines and set their audience" },
    { key: "deadlines.deadline.manage", description: "Edit or delete any visible deadline" },
    { key: "deadlines.deadline.complete", description: "Mark a deadline as met" },
    { key: "deadlines.deadline.viewall", description: "See every deadline, ignoring per-deadline visibility" },
    { key: "deadlines.reminder.run", description: "Trigger the reminder scan on demand" },
  ],
  events: [
    { type: "deadlines.deadline.created", description: "A deadline was created" },
    { type: "deadlines.deadline.completed", description: "A deadline was marked as met" },
    { type: "deadlines.deadline.deleted", description: "A deadline was deleted" },
    { type: "deadlines.reminder.sent", description: "Reminders were sent to a deadline's audience" },
  ],
  nav: [
    { label: "Upcoming", path: "" },
    { label: "Calendar", path: "/calendar" },
    { label: "Regions", path: "/map" },
    { label: "Mine", path: "/mine" },
    { label: "Completed", path: "/completed" },
  ],
});
