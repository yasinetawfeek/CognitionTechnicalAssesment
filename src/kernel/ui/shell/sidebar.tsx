"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/kernel/ui/icon";
import { Kbd, cn } from "@/kernel/ui/primitives";
import type { VisibleApp } from "./shell";

const CATEGORY_LABEL: Record<VisibleApp["category"], string> = {
  kernel: "Platform",
  operations: "Operations",
  engineering: "Engineering",
  finance: "Finance",
  other: "Other",
};
const CATEGORY_ORDER: VisibleApp["category"][] = ["operations", "finance", "engineering", "other", "kernel"];

export function Sidebar({ apps }: { apps: VisibleApp[] }) {
  const pathname = usePathname();
  const groups = CATEGORY_ORDER.map((c) => ({ category: c, apps: apps.filter((a) => a.category === c) })).filter((g) => g.apps.length);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <Link href="/" className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-fg">IT</span>
        <span className="text-sm font-semibold">Internal Tools</span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <NavLink href="/" active={pathname === "/"} icon="House" label="Home" />
        {groups.map((g) => (
          <div key={g.category} className="mt-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{CATEGORY_LABEL[g.category]}</p>
            {g.apps.map((app) => {
              const active = pathname === `/${app.id}` || pathname.startsWith(`/${app.id}/`);
              return (
                <div key={app.id}>
                  <NavLink href={`/${app.id}`} active={active} icon={app.icon} label={app.name} />
                  {active && app.nav.length > 0 && (
                    <div className="mb-1 ml-4 border-l border-border pl-2">
                      {app.nav.map((n) => (
                        <Link
                          key={n.href}
                          href={n.href}
                          className={cn(
                            "block rounded px-2 py-1 text-xs",
                            pathname === n.href ? "font-medium text-primary" : "text-muted hover:text-fg",
                          )}
                        >
                          {n.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-border px-4 py-3 text-xs text-muted">
        Jump anywhere <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
      </div>
    </aside>
  );
}

function NavLink({ href, active, icon, label }: { href: string; active: boolean; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
        active ? "bg-primary-soft font-medium text-primary" : "text-fg/80 hover:bg-bg hover:text-fg",
      )}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
