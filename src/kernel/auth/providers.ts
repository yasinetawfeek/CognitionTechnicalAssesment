/**
 * Auth provider abstraction.
 *
 * The kernel ships two providers:
 *  - `password`: email + password, hashed with bcrypt (used for the PoC / break-glass admin)
 *  - `oidc`: OpenID Connect authorization-code flow (Entra ID, Okta, Google...).
 *    Configured entirely through env vars; see ./oidc.ts.
 *
 * Both resolve to an `ExternalIdentity` that `signInWithIdentity` maps onto a local User row
 * (JIT-provisioning if allowed), so RBAC / audit / sessions work identically for every provider.
 */

export interface ExternalIdentity {
  provider: string;
  /** Stable subject id at the provider (for password auth, the user id). */
  externalId: string;
  email: string;
  name: string;
  /** Group / role claims from the IdP, mapped to kernel roles via OIDC_ROLE_MAP. */
  groups?: string[];
}

export interface PasswordCredentials {
  email: string;
  password: string;
}

export interface AuthProvider {
  readonly id: string;
  readonly name: string;
  readonly kind: "password" | "oidc";
  isConfigured(): boolean;
}

export interface PasswordAuthProvider extends AuthProvider {
  kind: "password";
  authenticate(credentials: PasswordCredentials): Promise<ExternalIdentity | null>;
}

export interface OidcAuthProvider extends AuthProvider {
  kind: "oidc";
  /** Build the redirect URL for the IdP; `state` must be verified on callback. */
  getAuthorizationUrl(params: { state: string; nonce: string; redirectUri: string }): Promise<string>;
  /** Exchange the code and return the verified identity. */
  handleCallback(params: { code: string; redirectUri: string }): Promise<ExternalIdentity>;
}
