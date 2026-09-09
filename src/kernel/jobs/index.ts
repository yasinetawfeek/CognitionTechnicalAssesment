import type { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { deliverPendingWebhooks } from "@/kernel/events/webhooks";

/**
 * Background jobs — a DB-backed queue polled by an in-process worker.
 *
 *   registerJobHandler("kyc.score-case", async (payload: { caseId: string }) => {
 *     const score = await fetch(process.env.ML_SERVICE_URL + "/score", ...);
 *     return { score };
 *   });
 *   await enqueueJob("kyc.score-case", { caseId });
 *
 * This is the extension point for ML / long-running work: the handler can call out to a Python
 * service, and the result lands in `Job.result` + a `job.completed` event other apps can react to.
 * Single-process for the PoC; swap `startJobWorker` for a real queue when scaling out.
 */

export type JobHandler<P = unknown, R = unknown> = (payload: P, job: { id: string; attempts: number }) => Promise<R>;

interface WorkerState {
  handlers: Map<string, JobHandler>;
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
}

const g = globalThis as unknown as { __jobWorker?: WorkerState };
const state: WorkerState = (g.__jobWorker ??= { handlers: new Map(), timer: null, running: false });

export function registerJobHandler<P, R>(type: string, handler: JobHandler<P, R>) {
  state.handlers.set(type, handler as JobHandler);
}

export function listJobHandlers() {
  return [...state.handlers.keys()];
}

export async function enqueueJob<P>(type: string, payload: P, opts?: { runAt?: Date; maxAttempts?: number }) {
  return db.job.create({
    data: {
      type,
      payload: JSON.parse(JSON.stringify(payload ?? null)) as Prisma.InputJsonValue,
      runAt: opts?.runAt ?? new Date(),
      maxAttempts: opts?.maxAttempts ?? 3,
    },
  });
}

/** Claim & run up to `limit` due jobs. Safe to call concurrently only within one process. */
export async function runDueJobs(limit = 5): Promise<number> {
  const due = await db.job.findMany({
    where: { status: "PENDING", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: limit,
  });
  let ran = 0;
  for (const job of due) {
    const handler = state.handlers.get(job.type);
    if (!handler) continue; // handler may be registered by a later bundle; leave pending
    const claimed = await db.job.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    const attempts = job.attempts + 1;
    try {
      const result = await handler(job.payload, { id: job.id, attempts });
      await db.job.update({
        where: { id: job.id },
        data: {
          status: "DONE",
          finishedAt: new Date(),
          result: result === undefined ? undefined : (JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue),
          lastError: null,
        },
      });
      await publish({ type: "job.completed", sourceAppId: "kernel", payload: { id: job.id, type: job.type, result: result ?? null } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const exhausted = attempts >= job.maxAttempts;
      await db.job.update({
        where: { id: job.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          lastError: message,
          finishedAt: exhausted ? new Date() : null,
          runAt: exhausted ? job.runAt : new Date(Date.now() + Math.min(2 ** attempts, 120) * 1000),
        },
      });
      if (exhausted) {
        await publish({ type: "job.failed", sourceAppId: "kernel", payload: { id: job.id, type: job.type, error: message } });
      }
    }
    ran++;
  }
  return ran;
}

export async function retryJob(id: string) {
  return db.job.update({ where: { id }, data: { status: "PENDING", runAt: new Date(), attempts: 0, lastError: null, finishedAt: null } });
}

export function startJobWorker(intervalMs = 2000) {
  if (state.timer) return;
  state.timer = setInterval(async () => {
    if (state.running) return;
    state.running = true;
    try {
      await runDueJobs();
      await deliverPendingWebhooks();
    } catch (err) {
      console.error("[jobs] worker tick failed", err);
    } finally {
      state.running = false;
    }
  }, intervalMs);
  console.log(`[kernel] job worker started (every ${intervalMs}ms)`);
}

export const jobs = { enqueue: enqueueJob, registerHandler: registerJobHandler, runDue: runDueJobs, retry: retryJob, start: startJobWorker };
