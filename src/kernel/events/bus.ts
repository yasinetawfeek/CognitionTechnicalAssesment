import type { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";

/**
 * Kernel event bus.
 *
 * `publish()` persists the event (so it is queryable / replayable and webhooks can be fanned out
 * from the outbox), then dispatches it to:
 *   1. in-process subscribers (`subscribe`) — app-to-app integration on the server
 *   2. connected browsers via SSE (see ./stream.ts) — live UI updates across apps
 *   3. the webhook outbox (see ./webhooks.ts) — external systems
 *
 * Event types follow `<app>.<entity>.<verb>` (e.g. `flag.updated`, `kyc.case.decided`).
 * Subscriptions accept the same wildcard patterns as permissions: `kyc.*`, `*`.
 */

export interface KernelEvent<T = unknown> {
  id: string;
  type: string;
  sourceAppId: string;
  actorId: string | null;
  correlationId: string | null;
  payload: T;
  createdAt: Date;
}

export type EventHandler<T = unknown> = (event: KernelEvent<T>) => void | Promise<void>;

interface Subscription {
  pattern: string;
  handler: EventHandler;
  name: string;
}

interface BusState {
  subscriptions: Subscription[];
  streamListeners: Set<(e: KernelEvent) => void>;
}

const g = globalThis as unknown as { __kernelBus?: BusState };
const state: BusState = (g.__kernelBus ??= { subscriptions: [], streamListeners: new Set() });

export function eventMatches(pattern: string, type: string): boolean {
  if (pattern === "*" || pattern === type) return true;
  if (pattern.endsWith(".*")) return type.startsWith(pattern.slice(0, -1));
  return false;
}

/**
 * Register a server-side handler. Idempotent per `name`, so calling it again after a hot reload
 * replaces the previous handler instead of stacking duplicates.
 */
export function subscribe<T = unknown>(pattern: string, name: string, handler: EventHandler<T>): () => void {
  state.subscriptions = state.subscriptions.filter((s) => s.name !== name);
  const sub: Subscription = { pattern, name, handler: handler as EventHandler };
  state.subscriptions.push(sub);
  return () => {
    state.subscriptions = state.subscriptions.filter((s) => s !== sub);
  };
}

export function listSubscriptions() {
  return state.subscriptions.map((s) => ({ pattern: s.pattern, name: s.name }));
}

/** Internal: used by the SSE stream to receive every event in this process. */
export function addStreamListener(fn: (e: KernelEvent) => void): () => void {
  state.streamListeners.add(fn);
  return () => state.streamListeners.delete(fn);
}

export function streamListenerCount() {
  return state.streamListeners.size;
}

export interface PublishInput<T = unknown> {
  type: string;
  sourceAppId: string;
  payload: T;
  actorId?: string | null;
  correlationId?: string | null;
}

export async function publish<T = unknown>(input: PublishInput<T>): Promise<KernelEvent<T>> {
  const row = await db.event.create({
    data: {
      type: input.type,
      sourceAppId: input.sourceAppId,
      actorId: input.actorId ?? null,
      correlationId: input.correlationId ?? null,
      payload: JSON.parse(JSON.stringify(input.payload ?? null)) as Prisma.InputJsonValue,
    },
  });
  const event: KernelEvent<T> = {
    id: row.id,
    type: row.type,
    sourceAppId: row.sourceAppId,
    actorId: row.actorId,
    correlationId: row.correlationId,
    payload: input.payload,
    createdAt: row.createdAt,
  };

  for (const sub of state.subscriptions) {
    if (!eventMatches(sub.pattern, event.type)) continue;
    Promise.resolve()
      .then(() => sub.handler(event))
      .catch((err) => console.error(`[events] handler "${sub.name}" failed for ${event.type}:`, err));
  }
  for (const listener of state.streamListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[events] stream listener failed:", err);
    }
  }
  // Webhook fan-out is lazy-imported to avoid a module cycle.
  import("./webhooks").then((m) => m.enqueueWebhookDeliveries(event)).catch((err) => {
    console.error("[events] webhook enqueue failed:", err);
  });
  return event;
}
