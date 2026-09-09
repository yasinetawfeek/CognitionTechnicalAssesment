"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/kernel/ui/icon";
import { Kbd, cn } from "@/kernel/ui/primitives";
import type { VisibleApp } from "./shell";

/**
 * Sidebar shows only platform surfaces. Business apps are installed and launched from the Apps
 * hub (/apps); while one is open, its secondary nav is shown nested under "Apps".
 */
export function Sidebar({ apps, myApps }: { apps: VisibleApp[]; myApps: VisibleApp[] }) {
  const pathname = usePathname();
  const hub = apps.find((a) => a.id === "apps");
  const platform = apps.filter((a) => a.id !== "apps");
  const isActive = (id: string) => pathname === `/${id}` || pathname.startsWith(`/${id}/`);
  const openApp = myApps.find((a) => isActive(a.id));

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <Link href="/" className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-fg">IT</span>
        <span className="text-sm font-semibold">Internal Tools</span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <NavLink href="/" active={pathname === "/"} icon="House" label="Home" />
        {hub && (
          <div>
            <NavLink href="/apps" active={isActive("apps") || !!openApp} icon={hub.icon} label={hub.name} badge={myApps.length || undefined} />
            {isActive("apps") && <SubNav items={hub.nav} pathname={pathname} />}
            {openApp && (
              <div className="mb-1 ml-4 border-l border-border pl-2">
                <Link
                  href={`/${openApp.id}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
                    pathname === `/${openApp.id}` ? "font-medium text-primary" : "text-fg hover:text-fg",
                  )}
                >
                  <Icon name={openApp.icon} className="h-3.5 w-3.5" /> {openApp.name}
                </Link>
                <SubNav items={openApp.nav.filter((n) => n.href !== `/${openApp.id}`)} pathname={pathname} className="ml-3" />
              </div>
            )}
          </div>
        )}
        {platform.length > 0 && (
          <div className="mt-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Platform</p>
            {platform.map((app) => {
              const active = isActive(app.id);
              return (
                <div key={app.id}>
                  <NavLink href={`/${app.id}`} active={active} icon={app.icon} label={app.name} />
                  {active && app.nav.length > 0 && <SubNav items={app.nav} pathname={pathname} />}
                </div>
              );
            })}
          </div>
        )}
      </nav>
      <div className="border-t border-border px-4 py-3 text-xs text-muted">
        Jump anywhere <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
      </div>
    </aside>
  );
}

function SubNav({ items, pathname, className }: { items: VisibleApp["nav"]; pathname: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn("mb-1 ml-4 border-l border-border pl-2", className)}>
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={cn("block rounded px-2 py-1 text-xs", pathname === n.href ? "font-medium text-primary" : "text-muted hover:text-fg")}
        >
          {n.label}
        </Link>
      ))}
    </div>
  );
}

function NavLink({ href, active, icon, label, badge }: { href: string; active: boolean; icon: string; label: string; badge?: number }) {
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
      {badge !== undefined && <span className="ml-auto rounded-full bg-bg px-1.5 text-[11px] text-muted">{badge}</span>}
    </Link>
  );
}
