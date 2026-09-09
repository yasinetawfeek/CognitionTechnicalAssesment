import type { ReactNode } from "react";
import { Shell } from "@/kernel/ui/shell/shell";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
