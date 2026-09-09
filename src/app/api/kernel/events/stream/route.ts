import type { NextRequest } from "next/server";
import { getContext } from "@/kernel/context";
import { createEventStreamResponse } from "@/kernel/events/stream";
import { appAccessPermission } from "@/kernel/rbac/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/kernel/events/stream?types=flag.*,kyc.case.*
 * Live kernel events for the signed-in user. Events are filtered so a user only receives events
 * from apps they can access, and notification events only for themselves.
 */
export async function GET(req: NextRequest) {
  const ctx = await getContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const patterns = (req.nextUrl.searchParams.get("types") ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return createEventStreamResponse({
    patterns,
    signal: req.signal,
    filter: (event) => {
      if (event.type === "notification.created") {
        return (event.payload as { userId?: string })?.userId === ctx.user.id;
      }
      if (event.sourceAppId === "kernel") return true;
      return ctx.can(appAccessPermission(event.sourceAppId)) || ctx.can("kernel.events.read");
    },
  });
}
