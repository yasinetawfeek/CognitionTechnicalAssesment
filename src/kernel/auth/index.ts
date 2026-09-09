import { db } from "@/kernel/db";
import { recordAudit } from "@/kernel/audit";
import { publish } from "@/kernel/events/bus";
import { KernelError } from "@/kernel/errors";
import { passwordProvider } from "./password";
import { oidcProvider } from "./oidc";
import type { ExternalIdentity } from "./providers";
import {
  clearSessionCookie,
  createSession,
  destroySessionByToken,
  requestMeta,
  SESSION_COOKIE,
  setSessionCookie,
} from "./session";
import { cookies } from "next/headers";

export { passwordProvider, oidcProvider };
export * from "./providers";
export * from "./session";
export { hashPassword, verifyPassword } from "./password";

export function listAuthProviders() {
  return [passwordProvider, oidcProvider].filter((p) => p.isConfigured());
}

/**
 * OIDC group → kernel role mapping, e.g.
 *   OIDC_ROLE_MAP="KYC-Reviewers=kyc_reviewer,Engineering=engineer"
 * When `OIDC_AUTO_PROVISION=true` unknown users are created with the mapped roles (or `viewer`).
 */
function mapGroupsToRoleKeys(groups: string[] | undefined): string[] {
  const raw = process.env.OIDC_ROLE_MAP ?? "";
  const map = new Map(
    raw
      .split(",")
      .map((pair) => pair.split("=").map((s) => s.trim()))
      .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1]),
  );
  return (groups ?? []).map((gname) => map.get(gname)).filter((r): r is string => !!r);
}

/** Map an authenticated identity onto a local user, then open a session + cookie. */
export async function signInWithIdentity(identity: ExternalIdentity, next?: string) {
  let user = await db.user.findUnique({ where: { email: identity.email } });

  if (!user) {
    if (identity.provider !== "oidc" || process.env.OIDC_AUTO_PROVISION !== "true") {
      throw new KernelError("No account for this identity. Ask an admin to invite you.", 403, "NO_ACCOUNT");
    }
    const roleKeys = mapGroupsToRoleKeys(identity.groups);
    const roles = await db.role.findMany({ where: { key: { in: roleKeys.length ? roleKeys : ["viewer"] } } });
    user = await db.user.create({
      data: {
        email: identity.email,
        name: identity.name,
        provider: "oidc",
        externalId: identity.externalId,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
    });
    await recordAudit(
      { id: user.id, email: user.email },
      { appId: "kernel", action: "user.provision", targetType: "User", targetId: user.id, after: { email: user.email, roles: roles.map((r) => r.key) } },
    );
    await publish({ type: "kernel.user.created", sourceAppId: "kernel", actorId: user.id, payload: { id: user.id, email: user.email, provider: "oidc" } });
  }

  if (user.status !== "ACTIVE") throw new KernelError("This account is disabled.", 403, "DISABLED");

  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(user.id, meta);
  await setSessionCookie(token, expiresAt);
  await recordAudit(
    { id: user.id, email: user.email, ip: meta.ip },
    { appId: "kernel", action: "auth.login", targetType: "User", targetId: user.id, metadata: { provider: identity.provider } },
  );
  await publish({ type: "kernel.auth.login", sourceAppId: "kernel", actorId: user.id, payload: { userId: user.id, provider: identity.provider } });
  return { user, next: safeNext(next) };
}

export async function signInWithPassword(email: string, password: string, next?: string) {
  const identity = await passwordProvider.authenticate({ email, password });
  if (!identity) {
    await recordAudit(
      { id: null, email: email.toLowerCase() },
      { appId: "kernel", action: "auth.login_failed", targetType: "User", metadata: { provider: "password" } },
    );
    throw new KernelError("Invalid email or password", 401, "BAD_CREDENTIALS");
  }
  return signInWithIdentity(identity, next);
}

export async function signOut(actor: { id: string; email: string }) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await destroySessionByToken(token);
  await clearSessionCookie();
  await recordAudit({ id: actor.id, email: actor.email }, { appId: "kernel", action: "auth.logout", targetType: "User", targetId: actor.id });
  await publish({ type: "kernel.auth.logout", sourceAppId: "kernel", actorId: actor.id, payload: { userId: actor.id } });
}

export function safeNext(next?: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
