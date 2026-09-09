import type { ReactNode } from "react";
import { AppFrame } from "@/kernel/ui/shell/app-frame";

export default function Layout({ children }: { children: ReactNode }) {
  return <AppFrame appId="admin">{children}</AppFrame>;
}
