"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface ClientKernelEvent<T = unknown> {
  id: string;
  type: string;
  sourceAppId: string;
  payload: T;
  createdAt: string;
}

type Listener = { patterns: string[]; fn: (e: ClientKernelEvent) => void };

/**
 * One EventSource per browser tab, shared by every hook instance. Browsers cap HTTP/1.1
 * connections per host (~6), so per-component streams would starve page loads.
 */
const shared: { es: EventSource | null; listeners: Set<Listener> } = { es: null, listeners: new Set() };

function matches(pattern: string, type: string) {
  return pattern === "*" || pattern === type || (pattern.endsWith(".*") && type.startsWith(pattern.slice(0, -1)));
}

function ensureStream() {
  if (shared.es) return;
  const es = new EventSource("/api/kernel/events/stream?types=*");
  es.addEventListener("kernel", (msg) => {
    let event: ClientKernelEvent;
    try {
      event = JSON.parse((msg as MessageEvent).data);
    } catch (err) {
      console.error("[events] bad payload", err);
      return;
    }
    for (const l of shared.listeners) if (l.patterns.some((p) => matches(p, event.type))) l.fn(event);
  });
  shared.es = es;
}

function addListener(l: Listener) {
  shared.listeners.add(l);
  ensureStream();
  return () => {
    shared.listeners.delete(l);
    if (shared.listeners.size === 0 && shared.es) {
      shared.es.close();
      shared.es = null;
    }
  };
}

/**
 * Subscribe to live kernel events from the browser.
 *
 *   useKernelEvents(["flag.*"], (e) => setFlags(...));
 *
 * Patterns support `app.*` wildcards and `*`.
 */
export function useKernelEvents<T = unknown>(patterns: string[], onEvent: (event: ClientKernelEvent<T>) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const key = patterns.join(",");

  useEffect(() => {
    if (!key) return;
    return addListener({ patterns: key.split(","), fn: (e) => handlerRef.current(e as ClientKernelEvent<T>) });
  }, [key]);
}

/**
 * Re-render the current server component tree whenever a matching event arrives.
 * Drop `<LiveRefresh patterns={["kyc.*"]} />` into any page for realtime tables.
 */
export function LiveRefresh({ patterns, debounceMs = 250 }: { patterns: string[]; debounceMs?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useKernelEvents(patterns, () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), debounceMs);
  });
  return null;
}
