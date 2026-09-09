import { defineApp } from "@/kernel/apps/types";

export const auditApp = defineApp({
  id: "audit",
  name: "Audit Log",
  description: "Tamper-evident record of every privileged action",
  icon: "ScrollText",
  category: "kernel",
  permissions: [],
  nav: [
    { label: "Log", path: "" },
    { label: "Integrity", path: "/verify" },
  ],
});
