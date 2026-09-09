import { defineApp } from "@/kernel/apps/types";

export const approvalsApp = defineApp({
  id: "approvals",
  name: "Approvals",
  description: "Maker-checker inbox for changes that need a second pair of eyes",
  icon: "ShieldCheck",
  category: "kernel",
  permissions: [],
  nav: [
    { label: "Inbox", path: "" },
    { label: "My requests", path: "/mine" },
    { label: "History", path: "/history" },
  ],
});
