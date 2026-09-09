import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { oidcProvider, safeNext } from "@/kernel/auth";

export async function GET(req: NextRequest) {
  if (!oidcProvider.isConfigured()) {
    return NextResponse.redirect(new URL("/login?error=SSO%20is%20not%20configured", req.url));
  }
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/oidc/callback", req.url).toString();
  const url = await oidcProvider.getAuthorizationUrl({ state, nonce, redirectUri });
  const res = NextResponse.redirect(url);
  const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" };
  res.cookies.set("oidc_state", state, cookieOpts);
  res.cookies.set("oidc_next", safeNext(req.nextUrl.searchParams.get("next")), cookieOpts);
  return res;
}
