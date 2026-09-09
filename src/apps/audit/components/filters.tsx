"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/kernel/ui";

export function AuditFilters({ apps }: { apps: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`?${next.toString()}`, { scroll: false });
  };
  return (
    <Select value={sp.get("app") ?? ""} onChange={(e) => set("app", e.target.value)} className="w-40">
      <option value="">All apps</option>
      {apps.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </Select>
  );
}
