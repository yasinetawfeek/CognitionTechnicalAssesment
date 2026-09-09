import type { ExternalIdentity, OidcAuthProvider } from "./providers";

/**
 * Generic OpenID Connect provider (authorization code flow).
 *
 * Env vars:
 *   OIDC_ISSUER        e.g. https://login.microsoftonline.com/<tenant>/v2.0
 *   OIDC_CLIENT_ID
 *   OIDC_CLIENT_SECRET
 *   OIDC_SCOPES        default "openid profile email"
 *   OIDC_GROUPS_CLAIM  claim carrying group/role names, default "groups"
 *   OIDC_DISPLAY_NAME  button label, default "Single sign-on"
 *
 * Identity is read from the `userinfo` endpoint over TLS, which avoids shipping a JWT
 * verification library for the PoC. For production, verify the id_token signature via JWKS.
 */

interface DiscoveryDocument {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

let discoveryCache: { issuer: string; doc: DiscoveryDocument } | null = null;

async function discover(issuer: string): Promise<DiscoveryDocument> {
  if (discoveryCache?.issuer === issuer) return discoveryCache.doc;
  const res = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const doc = (await res.json()) as DiscoveryDocument;
  discoveryCache = { issuer, doc };
  return doc;
}

function config() {
  return {
    issuer: process.env.OIDC_ISSUER ?? "",
    clientId: process.env.OIDC_CLIENT_ID ?? "",
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
    scopes: process.env.OIDC_SCOPES ?? "openid profile email",
    groupsClaim: process.env.OIDC_GROUPS_CLAIM ?? "groups",
    displayName: process.env.OIDC_DISPLAY_NAME ?? "Single sign-on",
  };
}

export const oidcProvider: OidcAuthProvider = {
  id: "oidc",
  get name() {
    return config().displayName;
  },
  kind: "oidc",
  isConfigured() {
    const c = config();
    return Boolean(c.issuer && c.clientId && c.clientSecret);
  },
  async getAuthorizationUrl({ state, nonce, redirectUri }) {
    const c = config();
    const doc = await discover(c.issuer);
    const url = new URL(doc.authorization_endpoint);
    url.searchParams.set("client_id", c.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", c.scopes);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    return url.toString();
  },
  async handleCallback({ code, redirectUri }): Promise<ExternalIdentity> {
    const c = config();
    const doc = await discover(c.issuer);
    const tokenRes = await fetch(doc.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }),
    });
    if (!tokenRes.ok) throw new Error(`OIDC token exchange failed: ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token: string };
    const infoRes = await fetch(doc.userinfo_endpoint, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) throw new Error(`OIDC userinfo failed: ${infoRes.status}`);
    const claims = (await infoRes.json()) as Record<string, unknown>;
    const email = String(claims.email ?? claims.preferred_username ?? "");
    if (!email) throw new Error("OIDC identity has no email claim");
    const groupsRaw = claims[c.groupsClaim];
    return {
      provider: "oidc",
      externalId: String(claims.sub),
      email: email.toLowerCase(),
      name: String(claims.name ?? email),
      groups: Array.isArray(groupsRaw) ? groupsRaw.map(String) : undefined,
    };
  },
};
