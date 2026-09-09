import { redirect } from "next/navigation";
import { getContext } from "@/kernel/context";
import { listAuthProviders, oidcProvider } from "@/kernel/auth";
import { safeNext } from "@/kernel/auth";
import { db } from "@/kernel/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (ctx) redirect(safeNext(sp.next));

  const providers = listAuthProviders();
  const demoUsers =
    process.env.NODE_ENV !== "production"
      ? await db.user.findMany({
          where: { provider: "password", status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { email: true, name: true, roles: { select: { role: { select: { name: true } } } } },
        })
      : [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-fg font-bold">IT</div>
          <h1 className="text-xl font-semibold">Sign in to Internal Tools</h1>
          <p className="mt-1 text-sm text-muted">One login for every internal app.</p>
        </div>
        <LoginForm
          next={sp.next}
          error={sp.error}
          oidc={providers.some((p) => p.id === "oidc") ? { name: oidcProvider.name } : null}
          demoUsers={demoUsers.map((u) => ({ email: u.email, name: u.name, roles: u.roles.map((r) => r.role.name).join(", ") }))}
        />
      </div>
    </main>
  );
}
