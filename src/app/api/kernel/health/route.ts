import { NextResponse } from "next/server";
import { db } from "@/kernel/db";
import { listApps } from "@/kernel/apps/registry";
import { listSubscriptions, streamListenerCount } from "@/kernel/events/bus";
import { listJobHandlers } from "@/kernel/jobs";

export const dynamic = "force-dynamic";

/** Unauthenticated liveness probe with a few kernel stats (no PII). */
export async function GET() {
  const [users, events, pendingJobs] = await Promise.all([
    db.user.count(),
    db.event.count(),
    db.job.count({ where: { status: "PENDING" } }),
  ]);
  return NextResponse.json({
    ok: true,
    apps: listApps().map((a) => a.id),
    users,
    events,
    pendingJobs,
    subscriptions: listSubscriptions().length,
    jobHandlers: listJobHandlers().length,
    sseClients: streamListenerCount(),
  });
}
