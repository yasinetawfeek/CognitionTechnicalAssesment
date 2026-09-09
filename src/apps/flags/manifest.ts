import { defineApp } from "@/kernel/apps/types";

/**
 * Feature flags are a kernel service (src/kernel/flags); this is its first-class control surface.
 * Apps declare flags they own via the `ownerAppId` field and read them with isEnabled()/useFlag().
 */
export const flagsApp = defineApp({
  id: "flags",
  name: "Feature Flags",
  description: "Platform-wide flags with user/role/percentage targeting, propagated live to every app",
  icon: "ToggleRight",
  category: "kernel",
  permissions: [],
  nav: [
    { label: "Flags", path: "", permission: "kernel.flags.read" },
    { label: "History", path: "/history", permission: "kernel.audit.read" },
  ],
});
