export { publish, subscribe, listSubscriptions, eventMatches, streamListenerCount } from "./bus";
export type { KernelEvent, EventHandler, PublishInput } from "./bus";
export { deliverPendingWebhooks, signWebhookBody } from "./webhooks";

/** Event types published by the kernel itself. */
export const KERNEL_EVENTS = [
  { type: "kernel.user.created", description: "A user account was created" },
  { type: "kernel.user.updated", description: "A user account was edited (roles, status, name)" },
  { type: "kernel.role.updated", description: "A role's permissions changed" },
  { type: "kernel.auth.login", description: "A user signed in" },
  { type: "kernel.auth.logout", description: "A user signed out" },
  { type: "flag.updated", description: "A feature flag was created, toggled or edited" },
  { type: "flag.deleted", description: "A feature flag was removed" },
  { type: "approval.requested", description: "An approval request was opened" },
  { type: "approval.decided", description: "An approval request was approved or rejected" },
  { type: "job.completed", description: "A background job finished successfully" },
  { type: "job.failed", description: "A background job exhausted its retries" },
  { type: "notification.created", description: "A notification was sent to a user" },
] as const;
