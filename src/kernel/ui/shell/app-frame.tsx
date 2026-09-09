import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { getApp } from "@/kernel/apps/registry";
import { appAccessPermission } from "@/kernel/rbac/permissions";
import { isEnabled } from "@/kernel/flags";
import { Icon } from "@/kernel/ui/icon";

/**
 * Wrap an app's `layout.tsx` with this to enforce `<appId>.access` (and the app's feature flag)
 * and render the app header. Pages inside can rely on the user being authorised for the app.
 */
export async function AppFrame({ appId, children }: { appId: string; children: ReactNode }) {
  const app = getApp(appId);
  if (!app) notFound();
  const ctx = await pageContext(appAccessPermission(app.id), `/${app.id}`);
  if (app.featureFlag && !(await isEnabled(app.featureFlag, ctx.user))) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-2 text-xs text-muted">
        <Icon name={app.icon} className="h-3.5 w-3.5" />
        <span className="font-medium text-fg">{app.name}</span>
        <span>·</span>
        <span>{app.description}</span>
      </div>
      {children}
    </div>
  );
}
