import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/kernel/db";

export const SESSION_COOKIE = "kernel_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const SLIDING_REFRESH_MS = 1000 * 60 * 15; // touch lastSeen at most every 15 min

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, meta?: { ip?: string; userAgent?: string }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt, ip: meta?.ip, userAgent: meta?.userAgent },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function destroySessionByToken(token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  status: string;
  provider: string;
  roles: { id: string; key: string; name: string }[];
  permissions: string[];
};

export async function loadUserWithPermissions(userId: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: { include: { permissions: true } } } } },
  });
  if (!user) return null;
  const permissions = new Set<string>();
  for (const ur of user.roles) for (const p of ur.role.permissions) permissions.add(p.permission);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    provider: user.provider,
    roles: user.roles.map((ur) => ({ id: ur.role.id, key: ur.role.key, name: ur.role.name })),
    permissions: [...permissions].sort(),
  };
}

/** Resolve the current request's session. Returns null when signed out / expired. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > SLIDING_REFRESH_MS) {
    db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }
  const user = await loadUserWithPermissions(session.userId);
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}
