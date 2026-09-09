/**
 * Server-side hooks for App Builder. Imported once at boot from src/apps/server.ts.
 */
import { db } from "@/kernel/db";
import { publish } from "@/kernel/events/bus";
import { registerApprovalHandler } from "@/kernel/approvals";
import { registerJobHandler } from "@/kernel/jobs";
import { getAppBuilderAdapter, runAppBuild, setAppRequestStatus } from "@/kernel/appbuilder";
import { notifyUsers } from "@/kernel/notifications";
import type { PublishApprovalPayload } from "./types";

// The build itself runs as a background job so the request page can show live progress.
registerJobHandler<{ requestId: string }, unknown>("builder.build-app", ({ requestId }) => runAppBuild(requestId));

// Admin decision. Approve = merge to main and mark published; reject = hand feedback back to the requester.
registerApprovalHandler<PublishApprovalPayload>("builder.app.publish", {
  onApproved: async (approval, ctx) => {
    const req = await db.appRequest.findUniqueOrThrow({ where: { id: approval.payload.requestId } });
    const { mergeCommit } = await getAppBuilderAdapter().merge(req);
    await setAppRequestStatus(req.id, "PUBLISHED", { publishedAt: new Date(), reviewNote: approval.decisionNote });
    await ctx.audit({ appId: "builder", action: "app.publish", targetType: "AppRequest", targetId: req.id, after: { appId: req.appId, mergeCommit, prUrl: req.prUrl } });
    await publish({ type: "app.published", sourceAppId: "builder", actorId: ctx.user.id, payload: { requestId: req.id, appId: req.appId, mergeCommit } });
    await notifyUsers([req.requestedById], {
      title: `${req.name} is live`,
      body: `Merged as ${mergeCommit}. Grant users the ${req.appId}.access permission in Admin → Roles to roll it out.`,
      href: `/builder/${req.id}`,
      appId: "builder",
    });
  },
  onRejected: async (approval, ctx) => {
    const req = await setAppRequestStatus(approval.payload.requestId, "REJECTED", { reviewNote: approval.decisionNote });
    await ctx.audit({ appId: "builder", action: "app.reject", targetType: "AppRequest", targetId: req.id, after: { note: approval.decisionNote } });
  },
});
