import { defineApp } from "@/kernel/apps/types";

/**
 * App Builder: request a new app in plain English → an AI coding agent builds it on a branch →
 * requester tests the preview → admin reviews (four-eyes) → published. Adapter in src/kernel/appbuilder.
 */
export const builderApp = defineApp({
  id: "builder",
  name: "App Builder",
  description: "Request new internal apps, built by Devin and gated by admin review",
  icon: "Hammer",
  category: "kernel",
  permissions: [
    { key: "builder.request.create", description: "Request a new app and send it for review" },
    { key: "builder.request.review", description: "Approve or reject app requests (publishes the app)" },
  ],
  events: [
    { type: "apprequest.created", description: "A new app was requested" },
    { type: "apprequest.progress", description: "Build progress from the agent session" },
    { type: "apprequest.updated", description: "An app request changed status" },
  ],
  nav: [
    { label: "Requests", path: "" },
    { label: "Review queue", path: "/review", permission: "builder.request.review" },
  ],
});
