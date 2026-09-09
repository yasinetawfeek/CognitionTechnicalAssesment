/**
 * Server-side hooks for the Deadlines app: the reminder scan job, its schedule, and the
 * subscriber that scans as soon as a deadline is created.
 */
import { db } from "@/kernel/db";
import { publish, subscribe } from "@/kernel/events/bus";
import { enqueueJob, registerJobHandler } from "@/kernel/jobs";
import { notifyUsers } from "@/kernel/notifications";
import { audienceFor } from "./data";
import { dueInWords, shouldNotify, stageFor, DAY_MS } from "./reminders";
import { STAGE_LABEL } from "./types";

const SCAN_JOB = "deadlines.scan-reminders";
const SCAN_INTERVAL_MS = 10 * 60 * 1000;

registerJobHandler<{ trigger?: string }, { scanned: number; reminded: number; notified: number }>(SCAN_JOB, async () => {
  const horizon = new Date(Date.now() + 14 * DAY_MS);
  const due = await db.financeDeadline.findMany({ where: { status: "OPEN", dueAt: { lte: horizon } }, orderBy: { dueAt: "asc" } });

  let reminded = 0;
  let notified = 0;
  for (const deadline of due) {
    const stage = stageFor(deadline.dueAt);
    if (!shouldNotify(stage, deadline.lastReminderStage)) continue;

    // Only the deadline's audience is notified — the same rule the UI filters with.
    const audience = await audienceFor(deadline);
    if (audience.length > 0) {
      await notifyUsers(
        audience.map((a) => a.id),
        {
          title: `${deadline.reference} ${STAGE_LABEL[stage]}: ${deadline.title}`,
          body: `${deadline.category} deadline${deadline.entity ? ` for ${deadline.entity}` : ""} — ${dueInWords(deadline.dueAt)}.`,
          href: `/deadlines/${deadline.id}`,
          appId: "deadlines",
        },
      );
      notified += audience.length;
    }

    await db.financeDeadline.update({ where: { id: deadline.id }, data: { lastReminderStage: stage, lastRemindedAt: new Date() } });
    await publish({
      type: "deadlines.reminder.sent",
      sourceAppId: "deadlines",
      actorId: null,
      payload: { deadlineId: deadline.id, reference: deadline.reference, stage, recipients: audience.length },
    });
    reminded++;
  }

  await scheduleNextScan(SCAN_INTERVAL_MS);
  return { scanned: due.length, reminded, notified };
});

/** Keep exactly one pending scan queued so the worker polls deadlines forever without a cron. */
async function scheduleNextScan(delayMs: number) {
  const pending = await db.job.count({ where: { type: SCAN_JOB, status: "PENDING" } });
  if (pending > 0) return;
  await enqueueJob(SCAN_JOB, { trigger: "schedule" }, { runAt: new Date(Date.now() + delayMs), maxAttempts: 1 });
}

subscribe<{ deadlineId: string }>("deadlines.deadline.created", "deadlines.scan-on-create", async () => {
  await enqueueJob(SCAN_JOB, { trigger: "created" }, { maxAttempts: 1 });
});

// Boot: run a scan shortly after startup, then every SCAN_INTERVAL_MS.
void scheduleNextScan(5_000).catch((err) => console.error("[deadlines] failed to schedule reminder scan", err));
