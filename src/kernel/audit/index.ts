import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";

/**
 * Append-only, hash-chained audit log.
 *
 * Every entry's `hash` = sha256(prevHash + canonical(entry)). Tampering with or deleting any row
 * breaks the chain, which `verifyAuditChain()` detects. Writes are serialised through a small
 * in-process mutex so the chain never forks under concurrent requests (single-process PoC).
 */

export interface AuditActor {
  id: string | null;
  email: string;
  ip?: string | null;
}

export interface AuditEntryInput {
  appId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

const GENESIS_HASH = "0".repeat(64);

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export interface HashableEntry {
  ts: Date;
  actorId: string | null;
  actorEmail: string;
  appId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  ip: string | null;
}

export function computeAuditHash(prevHash: string, entry: HashableEntry): string {
  const body = canonicalJson({
    ts: entry.ts.toISOString(),
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    appId: entry.appId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    metadata: entry.metadata ?? null,
    ip: entry.ip,
  });
  return createHash("sha256").update(prevHash).update(body).digest("hex");
}

const g = globalThis as unknown as { __auditLock?: Promise<void> };
async function withAuditLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__auditLock ?? Promise.resolve();
  let release!: () => void;
  g.__auditLock = new Promise<void>((r) => (release = r));
  try {
    await prev;
    return await fn();
  } finally {
    release();
  }
}

function toJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

export async function recordAudit(actor: AuditActor, input: AuditEntryInput) {
  return withAuditLock(async () => {
    const last = await db.auditLog.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const entry: HashableEntry = {
      ts: new Date(),
      actorId: actor.id,
      actorEmail: actor.email,
      appId: input.appId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      metadata: input.metadata ?? null,
      ip: actor.ip ?? null,
    };
    const hash = computeAuditHash(prevHash, entry);
    return db.auditLog.create({
      data: {
        ts: entry.ts,
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        appId: entry.appId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        before: toJson(entry.before),
        after: toJson(entry.after),
        metadata: toJson(entry.metadata),
        ip: entry.ip,
        prevHash,
        hash,
      },
    });
  });
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  firstBrokenSeq?: number;
}

export async function verifyAuditChain(): Promise<ChainVerification> {
  const rows = await db.auditLog.findMany({ orderBy: { seq: "asc" } });
  let prev = GENESIS_HASH;
  for (const row of rows) {
    const expected = computeAuditHash(prev, {
      ts: row.ts,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      appId: row.appId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      before: row.before,
      after: row.after,
      metadata: row.metadata,
      ip: row.ip,
    });
    if (row.prevHash !== prev || row.hash !== expected) {
      return { ok: false, checked: rows.length, firstBrokenSeq: row.seq };
    }
    prev = row.hash;
  }
  return { ok: true, checked: rows.length };
}

export const audit = { record: recordAudit, verify: verifyAuditChain };
