"use client";

import { useState } from "react";
import { ActionForm, Card, CardBody, Field, FieldError, Input, SubmitButton, Alert, buttonClass } from "@/kernel/ui";
import { loginAction } from "./actions";

export function LoginForm({
  next,
  error,
  oidc,
  demoUsers,
}: {
  next?: string;
  error?: string;
  oidc: { name: string } | null;
  demoUsers: { email: string; name: string; roles: string }[];
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          {error && <Alert tone="danger">{decodeURIComponent(error)}</Alert>}
          {oidc && (
            <>
              <a href={`/api/auth/oidc/start${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={buttonClass("secondary", "md", "w-full")}>
                Continue with {oidc.name}
              </a>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <ActionForm action={loginAction}>
            {next && <input type="hidden" name="next" value={next} />}
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <FieldError name="email" />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <FieldError name="password" />
            </Field>
            <SubmitButton className="w-full" pendingText="Signing in…">
              Sign in
            </SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>

      {demoUsers.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Demo accounts (password: password)</p>
            <ul className="divide-y divide-border">
              {demoUsers.map((u) => (
                <li key={u.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword("password");
                    }}
                    className="flex w-full items-center justify-between py-2 text-left text-sm hover:text-primary"
                  >
                    <span>
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-2 text-muted">{u.email}</span>
                    </span>
                    <span className="text-xs text-muted">{u.roles}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
