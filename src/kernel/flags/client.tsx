"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useKernelEvents } from "@/kernel/events/client";

type FlagMap = Record<string, boolean>;

const FlagContext = createContext<{ flags: FlagMap; ready: boolean }>({ flags: {}, ready: false });

/**
 * Mounted once in the shell. Bootstraps the current user's evaluated flags and re-fetches whenever
 * a `flag.*` event arrives, so toggling a flag in the admin panel updates every open tab.
 */
export function FlagProvider({ initial, children }: { initial: FlagMap; children: ReactNode }) {
  const [flags, setFlags] = useState<FlagMap>(initial);
  const [ready, setReady] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/kernel/flags", { cache: "no-store" });
      if (res.ok) setFlags(await res.json());
    } finally {
      setReady(true);
    }
  }, []);

  useKernelEvents(["flag.*"], () => {
    void refresh();
  });

  useEffect(() => {
    setFlags(initial);
  }, [initial]);

  return <FlagContext.Provider value={{ flags, ready }}>{children}</FlagContext.Provider>;
}

export function useFlag(key: string): boolean {
  return useContext(FlagContext).flags[key] ?? false;
}

export function useFlags(): FlagMap {
  return useContext(FlagContext).flags;
}
