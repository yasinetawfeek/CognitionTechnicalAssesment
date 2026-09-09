import type { ReactNode } from "react";
import { pageContext } from "@/kernel/context";
import { listApps } from "@/kernel/apps/registry";
import { appAccessPermission } from "@/kernel/rbac/permissions";
import { evaluateAll } from "@/kernel/flags";
import { FlagProvider } from "@/kernel/flags/client";
import type { AppManifest } from "@/kernel/apps/types";
import { CommandPalette, type CommandItem } from "@/kernel/ui/command-palette";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export interface VisibleApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AppManifest["category"];
  nav: { label: string; href: string }[];
}

export async function visibleAppsFor(permissions: string[], flagState: Record<string, boolean>): Promise<VisibleApp[]> {
  const can = (p: string) => permissions.some((g) => g === "*" || g === p || (g.endsWith(".*") && p.startsWith(g.slice(0, -1))));
  return listApps()
    .filter((a) => !a.hidden)
    .filter((a) => can(appAccessPermission(a.id)))
    .filter((a) => !a.featureFlag || flagState[a.featureFlag])
    .map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      nav: (a.nav ?? []).filter((n) => !n.permission || can(n.permission)).map((n) => ({ label: n.label, href: `/${a.id}${n.path}` })),
    }));
}

export async function Shell({ children }: { children: ReactNode }) {
  const ctx = await pageContext();
  const flagState = await evaluateAll(ctx.user);
  const apps = await visibleAppsFor(ctx.user.permissions, flagState);

  const commands: CommandItem[] = [
    { id: "home", label: "Home", href: "/", icon: "House" },
    ...apps.flatMap((a) => [
      { id: a.id, label: a.name, hint: a.description, href: `/${a.id}`, icon: a.icon },
      ...a.nav.map((n) => ({ id: `${a.id}:${n.href}`, label: n.label, group: a.name, href: n.href, icon: a.icon })),
    ]),
  ];

  return (
    <FlagProvider initial={flagState}>
      <div className="flex min-h-screen">
        <Sidebar apps={apps} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={{ name: ctx.user.name, email: ctx.user.email, roles: ctx.user.roles.map((r) => r.name) }} />
          <main className="flex-1 px-6 py-6 lg:px-8">{children}</main>
        </div>
      </div>
      <CommandPalette items={commands} />
    </FlagProvider>
  );
}
