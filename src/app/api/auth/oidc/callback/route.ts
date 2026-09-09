import { NextResponse, type NextRequest } from "next/server";
import { oidcProvider, signInWithIdentity } from "@/kernel/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("oidc_state")?.value;
  const next = req.cookies.get("oidc_next")?.value ?? "/";

  const fail = (msg: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url));
    res.cookies.delete("oidc_state");
    res.cookies.delete("oidc_next");
    return res;
  };

  if (!code || !state || !expectedState || state !== expectedState) return fail("Invalid SSO state");
  try {
    const redirectUri = new URL("/api/auth/oidc/callback", req.url).toString();
    const identity = await oidcProvider.handleCallback({ code, redirectUri });
    const result = await signInWithIdentity(identity, next);
    const res = NextResponse.redirect(new URL(result.next, req.url));
    res.cookies.delete("oidc_state");
    res.cookies.delete("oidc_next");
    return res;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "SSO sign-in failed");
  }
}
