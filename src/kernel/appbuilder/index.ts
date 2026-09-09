import type { Prisma } from "@prisma/client";
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { notifyUsers } from "@/kernel/notifications";

/**
 * App Builder — lets platform users request new apps that an AI coding agent builds on a branch,
 * then test the result and send it to an admin for review before it goes live.
 *
 * The agent/VCS integration sits behind `AppBuilderAdapter`. The PoC ships `mockAdapter`, which
 * simulates a Devin session step by step; a real one would call the Devin API
 * (POST /v1/sessions with a prompt assembled from AGENTS.md + docs/APP_AUTHORING.md + the request),
 * poll the session, and merge the PR through the GitHub API on approval.
 */

export type AppRequestStatus =
  | "QUEUED"
  | "BUILDING"
  | "READY_FOR_TESTING"
  | "IN_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "FAILED";

export interface BuildLogEntry {
  at: string;
  step: string;
  detail?: string;
}

export interface BuildStartResult {
  sessionId: string;
  sessionUrl: string;
  branch: string;
}

export interface BuildFinishResult {
  prUrl: string;
  previewUrl: string;
}

export interface AppBuilderAdapter {
  name: string;
  /** Kick off an agent session for the request. */
  start(req: { id: string; appId: string; name: string; requirements: string }): Promise<BuildStartResult>;
  /**
   * Drive the build to completion, reporting progress via `log`. Resolves with the PR + preview URL
   * once the branch is ready to try out.
   */
  run(req: { id: string; appId: string; name: string }, log: (step: string, detail?: string) => Promise<void>): Promise<BuildFinishResult>;
  /** Merge the reviewed branch into main. */
  merge(req: { id: string; appId: string; branch: string | null; prUrl: string | null }): Promise<{ mergeCommit: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOCK_STEPS: [string, string][] = [
  ["Reading AGENTS.md and docs/APP_AUTHORING.md", "Learning the kernel's app contract"],
  ["Scaffolding app", "npm run create-app -- <id> \"<Name>\""],
  ["Adding Prisma model and seed data", "prisma/schema.prisma, prisma/seed.ts"],
  ["Implementing pages, actions and server hooks", "src/apps/<id>/*"],
  ["Running lint, typecheck and tests", "npm run lint && npm run typecheck && npm run test"],
  ["Opening pull request", "Branch pushed, preview deployed"],
];

/** Simulated Devin: no network, deterministic, ~15s end to end so the demo stays snappy. */
export const mockAdapter: AppBuilderAdapter = {
  name: "Mock Devin (PoC)",
  async start(req) {
    const sessionId = `devin-mock-${req.id.slice(-8)}`;
    return {
      sessionId,
      sessionUrl: `https://app.devin.ai/sessions/${sessionId}`,
      branch: `apps/${req.appId}`,
    };
  },
  async run(req, log) {
    for (const [step, detail] of MOCK_STEPS) {
      await sleep(2000);
      await log(step, detail.replace("<id>", req.appId).replace("<Name>", req.name));
    }
    return {
      prUrl: `https://github.com/example/internal-tools/pull/${100 + parseInt(req.id.slice(-3), 36)}`,
      previewUrl: `/builder/${req.id}/preview`,
    };
  },
  async merge() {
    await sleep(500);
    return { mergeCommit: Math.random().toString(16).slice(2, 9) };
  },
};

export function getAppBuilderAdapter(): AppBuilderAdapter {
  return mockAdapter;
}

async function appendLog(id: string, entry: BuildLogEntry) {
  const req = await db.appRequest.findUniqueOrThrow({ where: { id }, select: { buildLog: true } });
  const log = Array.isArray(req.buildLog) ? (req.buildLog as unknown as BuildLogEntry[]) : [];
  await db.appRequest.update({
    where: { id },
    data: { buildLog: [...log, entry] as unknown as Prisma.InputJsonValue },
  });
  await publish({ type: "apprequest.progress", sourceAppId: "builder", payload: { id, ...entry } });
}

export async function setAppRequestStatus(id: string, status: AppRequestStatus, extra?: Prisma.AppRequestUpdateInput) {
  const updated = await db.appRequest.update({ where: { id }, data: { status, ...extra } });
  await publish({ type: "apprequest.updated", sourceAppId: "builder", payload: { id, appId: updated.appId, status } });
  return updated;
}

/** Job handler body: runs the adapter for one request. Registered from src/apps/builder/server.ts. */
export async function runAppBuild(id: string) {
  const adapter = getAppBuilderAdapter();
  const req = await db.appRequest.findUniqueOrThrow({ where: { id } });
  if (req.status !== "QUEUED" && req.status !== "FAILED") return { skipped: true };

  const started = await adapter.start(req);
  await setAppRequestStatus(id, "BUILDING", {
    sessionId: started.sessionId,
    sessionUrl: started.sessionUrl,
    branch: started.branch,
    buildLog: [] as unknown as Prisma.InputJsonValue,
  });
  await appendLog(id, { at: new Date().toISOString(), step: `Session started (${adapter.name})`, detail: started.sessionUrl });

  try {
    const done = await adapter.run(req, (step, detail) => appendLog(id, { at: new Date().toISOString(), step, detail }));
    await setAppRequestStatus(id, "READY_FOR_TESTING", { prUrl: done.prUrl, previewUrl: done.previewUrl });
    await notifyUsers([req.requestedById], {
      title: `${req.name} is ready to test`,
      body: "Try the preview, then send it for review.",
      href: `/builder/${id}`,
      appId: "builder",
    });
    return { prUrl: done.prUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendLog(id, { at: new Date().toISOString(), step: "Build failed", detail: message });
    await setAppRequestStatus(id, "FAILED");
    throw err;
  }
}
