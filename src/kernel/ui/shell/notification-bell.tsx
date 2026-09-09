"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKernelEvents } from "@/kernel/events/client";
import { Icon } from "@/kernel/ui/icon";
import { RelativeTime } from "@/kernel/ui/client";
import { Button, cn } from "@/kernel/ui/primitives";

interface Item {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  appId: string;
  appName: string;
  appIcon: string;
}

export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/kernel/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { items: Item[]; unread: number };
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useKernelEvents(["notification.created"], () => void load());

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const markAll = async () => {
    await fetch("/api/kernel/notifications", { method: "POST", body: JSON.stringify({}) });
    void load();
  };
  const markOne = async (id: string) => {
    await fetch("/api/kernel/notifications", { method: "POST", body: JSON.stringify({ id }) });
    void load();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-bg hover:text-fg"
        aria-label={`Notifications (${unread} unread)`}
      >
        <Icon name="Bell" className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAll}>
                Mark all read
              </Button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">You&apos;re all caught up</li>}
            {items.map((n) => (
              <li key={n.id} className={cn("border-b border-border last:border-0", !n.readAt && "bg-primary-soft/40")}>
                <Link
                  href={n.href ?? "#"}
                  onClick={() => {
                    setOpen(false);
                    if (!n.readAt) void markOne(n.id);
                  }}
                  className="block px-3 py-2.5 hover:bg-bg"
                >
                  <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                    <Icon name={n.appIcon} className="h-3 w-3" />
                    {n.appName}
                  </p>
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                  <RelativeTime date={n.createdAt} className="mt-1 block text-[11px] text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
