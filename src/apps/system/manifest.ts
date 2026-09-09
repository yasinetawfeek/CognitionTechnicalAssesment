import { defineApp } from "@/kernel/apps/types";

export const systemApp = defineApp({
  id: "system",
  name: "System",
  description: "Event stream, feature flags, background jobs and webhooks",
  icon: "Cpu",
  category: "kernel",
  permissions: [],
  nav: [
    { label: "Events", path: "", permission: "kernel.events.read" },
    { label: "Feature flags", path: "/flags", permission: "kernel.flags.read" },
    { label: "Jobs", path: "/jobs", permission: "kernel.jobs.read" },
    { label: "Webhooks", path: "/webhooks", permission: "kernel.webhooks.manage" },
    { label: "Apps", path: "/apps" },
  ],
});
