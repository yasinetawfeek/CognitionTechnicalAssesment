/**
 * Internal Tools Kernel — public surface for apps.
 *
 *   import { kernel } from "@/kernel";
 *   const ctx = await kernel.requirePermission("kyc.case.review");
 *   await kernel.events.publish({ type: "kyc.case.assigned", sourceAppId: "kyc", payload });
 *
 * Server-only. For client components use `@/kernel/events/client`, `@/kernel/flags/client` and
 * the UI kit in `@/kernel/ui`.
 */
export { db } from "./db";
export * from "./errors";
export * from "./context";
export { action, parseForm, formField, toActionError, type ActionState } from "./actions";
export { defineApp, type AppManifest, type AppNavItem } from "./apps/types";
export { listApps, getApp, listPermissionGroups, listAllEventTypes } from "./apps/registry";
export { audit, recordAudit, verifyAuditChain } from "./audit";
export { publish, subscribe, KERNEL_EVENTS, type KernelEvent } from "./events";
export { approvals, requestApproval, decideApproval, registerApprovalHandler } from "./approvals";
export { notifications, notifyUsers, notifyPermissionHolders } from "./notifications";
export { flags, isEnabled as isFlagEnabled } from "./flags";
export { jobs, enqueueJob, registerJobHandler } from "./jobs";
export { settings } from "./settings";
export { rbac, hasPermission, appAccessPermission } from "./rbac";

import { getContext, requireUser, requirePermission, requireAppAccess, pageContext } from "./context";
import { audit } from "./audit";
import { publish, subscribe } from "./events";
import { approvals } from "./approvals";
import { notifications } from "./notifications";
import { flags } from "./flags";
import { jobs } from "./jobs";
import { settings } from "./settings";
import { rbac } from "./rbac";
import { db } from "./db";

export const kernel = {
  db,
  getContext,
  requireUser,
  requirePermission,
  requireAppAccess,
  pageContext,
  audit,
  events: { publish, subscribe },
  approvals,
  notifications,
  flags,
  jobs,
  settings,
  rbac,
};
