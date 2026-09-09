import { defineApp } from "@/kernel/apps/types";

export const adminApp = defineApp({
  id: "admin",
  name: "Users & Roles",
  description: "Manage accounts, roles and permissions",
  icon: "Users",
  category: "kernel",
  // Kernel permissions (kernel.users.*, kernel.roles.*) govern the actions inside this app.
  permissions: [],
  nav: [
    { label: "Users", path: "" },
    { label: "Roles", path: "/roles", permission: "kernel.roles.manage" },
    { label: "Permissions", path: "/permissions" },
  ],
});
