import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/kernel/context";
import { listNotifications, markRead, unreadCount } from "@/kernel/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [items, unread] = await Promise.all([listNotifications(ctx.user.id), unreadCount(ctx.user.id)]);
  return NextResponse.json({ items, unread });
}

/** POST { id?: string } — mark one (or all) notifications read. */
export async function POST(req: NextRequest) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  await markRead(ctx.user.id, body.id);
  return NextResponse.json({ ok: true });
}
