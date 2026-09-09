import { createHmac } from "crypto";
import { db } from "@/kernel/db";
import { eventMatches, type KernelEvent } from "./bus";

/**
 * Outbound webhooks: every published event is matched against active subscriptions and a
 * `WebhookDelivery` row is created (outbox pattern). `deliverPendingWebhooks()` is invoked by the
 * background worker, retries with exponential backoff and signs bodies with HMAC-SHA256
 * (`X-Kernel-Signature: sha256=<hex>`).
 */

const MAX_ATTEMPTS = 5;

export async function enqueueWebhookDeliveries(event: KernelEvent) {
  const subs = await db.webhookSubscription.findMany({ where: { active: true } });
  const matching = subs.filter((s) =>
    s.eventTypes
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .some((p) => eventMatches(p, event.type)),
  );
  if (matching.length === 0) return;
  await db.webhookDelivery.createMany({
    data: matching.map((s) => ({ subscriptionId: s.id, eventId: event.id })),
  });
}

export function signWebhookBody(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export async function deliverPendingWebhooks(limit = 20): Promise<number> {
  const due = await db.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    include: { subscription: true, event: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  let delivered = 0;
  for (const d of due) {
    const body = JSON.stringify({
      id: d.event.id,
      type: d.event.type,
      sourceAppId: d.event.sourceAppId,
      createdAt: d.event.createdAt,
      payload: d.event.payload,
    });
    const attempts = d.attempts + 1;
    try {
      const res = await fetch(d.subscription.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-kernel-event": d.event.type,
          "x-kernel-delivery": d.id,
          "x-kernel-signature": signWebhookBody(d.subscription.secret, body),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await db.webhookDelivery.update({
        where: { id: d.id },
        data: { status: "DELIVERED", attempts, responseStatus: res.status, deliveredAt: new Date(), lastError: null },
      });
      delivered++;
    } catch (err) {
      const failed = attempts >= MAX_ATTEMPTS;
      await db.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: failed ? "FAILED" : "PENDING",
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
          nextAttemptAt: new Date(Date.now() + Math.min(2 ** attempts, 300) * 1000),
        },
      });
    }
  }
  return delivered;
}
