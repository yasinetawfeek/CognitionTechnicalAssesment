import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContext } from "@/kernel/context";
import { getApp } from "@/kernel/apps/registry";
import { appAccessPermission } from "@/kernel/rbac/permissions";
import { isEnabled } from "@/kernel/flags";
import { isInstalled, isKernelSurface } from "@/kernel/apps/installs";
import { Icon } from "@/kernel/ui/icon";

/**
 * Wrap an app's `layout.tsx` with this to enforce `<appId>.access` (and the app's feature flag)
 * and render the app header. Pages inside can rely on the user being authorised for the app.
 */
export async function AppFrame({ appId, children }: { appId: string; children: ReactNode }) {
  const app = getApp(appId);
  if (!app) notFound();
  const ctx = await pageContext(app.alwaysAvailable ? undefined : appAccessPermission(app.id), `/${app.id}`);
  if (app.featureFlag && !(await isEnabled(app.featureFlag, ctx.user))) notFound();
  const notInstalled = !isKernelSurface(app) && !(await isInstalled(ctx.user.id, app.id));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-2 text-xs text-muted">
        <Icon name={app.icon} className="h-3.5 w-3.5" />
        <span className="font-medium text-fg">{app.name}</span>
        <span>·</span>
        <span>{app.description}</span>
        {notInstalled && (
          <Link href="/apps/store" className="ml-auto underline">
            Not in My apps — add it from the App Store
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
