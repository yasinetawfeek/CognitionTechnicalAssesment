"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox, Select } from "@/kernel/ui";
import { CASE_STATUSES, RISK_LEVELS } from "../types";

/** URL-state filters (?status=&risk=&q=) so the queue page stays a plain server component. */
export function QueueFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchBox placeholder="Search name, email or reference…" />
      <Select value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)} className="w-auto">
        <option value="">Open cases</option>
        {CASE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
        <option value="ALL">All</option>
      </Select>
      <Select value={sp.get("risk") ?? ""} onChange={(e) => set("risk", e.target.value)} className="w-auto">
        <option value="">Any risk</option>
        {RISK_LEVELS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
        <option value="UNSCORED">Unscored</option>
      </Select>
      <label className="ml-1 inline-flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" checked={sp.get("unassigned") === "1"} onChange={(e) => set("unassigned", e.target.checked ? "1" : "")} />
        Unassigned only
      </label>
    </div>
  );
}
