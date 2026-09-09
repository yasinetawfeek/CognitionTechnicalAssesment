"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { Kbd, cn } from "./primitives";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon?: string;
  group?: string;
}

/** Ctrl/Cmd+K launcher listing every app + nav item the user can access. */
export function CommandPalette({ items }: { items: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => `${i.group ?? ""} ${i.label} ${i.hint ?? ""}`.toLowerCase().includes(needle));
  }, [items, q]);

  if (!open) return null;

  const go = (item: CommandItem) => {
    setOpen(false);
    router.push(item.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Icon name="Search" className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, filtered.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && filtered[active]) go(filtered[active]);
            }}
            placeholder="Jump to an app or page…"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches</li>}
          {filtered.map((item, i) => (
            <li key={item.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                  i === active ? "bg-primary-soft text-primary" : "hover:bg-bg",
                )}
              >
                <Icon name={item.icon ?? "ArrowRight"} className="h-4 w-4 shrink-0 opacity-70" />
                <span className="flex-1 truncate">
                  {item.group && <span className="text-muted">{item.group} / </span>}
                  {item.label}
                </span>
                {item.hint && <span className="truncate text-xs text-muted">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
