import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, requestMeta, type SessionUser } from "@/kernel/auth/session";
import { hasPermission, appAccessPermission } from "@/kernel/rbac/permissions";
import { ForbiddenError, UnauthorizedError } from "@/kernel/errors";
import { recordAudit, type AuditEntryInput } from "@/kernel/audit";

/**
 * Per-request kernel context: who is calling, what they may do, and helpers to audit actions.
 *
 *   const ctx = await requirePermission("kyc.case.approve");
 *   ...
 *   await ctx.audit({ appId: "kyc", action: "case.approve", targetType: "KycCase", targetId });
 */
export interface KernelContext {
  user: SessionUser;
  ip?: string;
  can(permission: string): boolean;
  require(permission: string): void;
  audit(input: AuditEntryInput): Promise<unknown>;
}

function buildContext(user: SessionUser, ip?: string): KernelContext {
  return {
    user,
    ip,
    can: (permission) => hasPermission(user.permissions, permission),
    require(permission) {
      if (!hasPermission(user.permissions, permission)) throw new ForbiddenError(permission);
    },
    audit: (input) => recordAudit({ id: user.id, email: user.email, ip }, input),
  };
}

/** Cached per request (React `cache`) so layouts/pages/actions share one DB lookup. */
export const getContext = cache(async (): Promise<KernelContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const meta = await requestMeta();
  return buildContext(user, meta.ip);
});

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireUser(): Promise<KernelContext> {
  const ctx = await getContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

export async function requirePermission(permission: string): Promise<KernelContext> {
  const ctx = await requireUser();
  ctx.require(permission);
  return ctx;
}

export async function requireAppAccess(appId: string): Promise<KernelContext> {
  return requirePermission(appAccessPermission(appId));
}

/** For pages/layouts: redirects to login (or /forbidden) instead of throwing. */
export async function pageContext(permission?: string, returnTo?: string): Promise<KernelContext> {
  const ctx = await getContext();
  if (!ctx) redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  if (permission && !ctx.can(permission)) redirect(`/forbidden?permission=${encodeURIComponent(permission)}`);
  return ctx;
}

/** System actor for background jobs / seeds. */
export const SYSTEM_ACTOR = { id: null, email: "system@kernel" } as const;
