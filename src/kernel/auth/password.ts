import bcrypt from "bcryptjs";
import { db } from "@/kernel/db";
import type { ExternalIdentity, PasswordAuthProvider, PasswordCredentials } from "./providers";

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const passwordProvider: PasswordAuthProvider = {
  id: "password",
  name: "Email & password",
  kind: "password",
  isConfigured: () => true,
  async authenticate({ email, password }: PasswordCredentials): Promise<ExternalIdentity | null> {
    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Constant-ish time: always run a compare even when the user is missing.
    const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
    const ok = await verifyPassword(password, hash);
    if (!user || !user.passwordHash || !ok) return null;
    return { provider: "password", externalId: user.id, email: user.email, name: user.name };
  },
};
