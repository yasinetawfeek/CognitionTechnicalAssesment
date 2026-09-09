import { defineApp } from "@/kernel/apps/types";

/**
 * The Apps hub: browse the App Store, install apps into "My apps" and open them from there.
 * Business apps are not shown in the sidebar — this is the one place they are launched from.
 */
export const appsHubApp = defineApp({
  id: "apps",
  name: "Apps",
  description: "Your installed apps and the App Store",
  icon: "LayoutGrid",
  category: "kernel",
  alwaysAvailable: true,
  permissions: [],
  events: [
    { type: "app.installed", description: "A user added an app to My apps" },
    { type: "app.uninstalled", description: "A user removed an app from My apps" },
  ],
  nav: [
    { label: "My apps", path: "" },
    { label: "App Store", path: "/store" },
  ],
});
