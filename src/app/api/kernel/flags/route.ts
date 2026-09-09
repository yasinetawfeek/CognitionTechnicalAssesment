import { NextResponse } from "next/server";
import { getContext } from "@/kernel/context";
import { evaluateAll } from "@/kernel/flags";

export const dynamic = "force-dynamic";

/** GET /api/kernel/flags → { [flagKey]: boolean } evaluated for the current user. */
export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({}, { status: 401 });
  return NextResponse.json(await evaluateAll(ctx.user));
}
