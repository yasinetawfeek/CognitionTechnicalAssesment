import { defineApp } from "@/kernel/apps/types";

/**
 * Reference app. Exercises every kernel primitive in ~200 lines so app authors have a
 * working example to copy: RBAC, audit, events + live refresh, approvals, flags, jobs.
 */
export const playgroundApp = defineApp({
  id: "playground",
  name: "Playground",
  description: "Reference app showing how to build on the kernel",
  icon: "FlaskConical",
  category: "engineering",
  permissions: [
    { key: "playground.record.create", description: "Create draft records" },
    { key: "playground.record.submit", description: "Submit a record for approval" },
    { key: "playground.record.approve", description: "Approve or reject submitted records (four-eyes)" },
    { key: "playground.record.delete", description: "Delete records" },
  ],
  events: [
    { type: "playground.record.created", description: "A record was created" },
    { type: "playground.record.decided", description: "A record was approved or rejected" },
    { type: "playground.record.scored", description: "The demo ML job scored a record" },
  ],
  nav: [
    { label: "Records", path: "" },
    { label: "How it works", path: "/guide" },
  ],
});
