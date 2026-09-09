import type { KernelContext } from "@/kernel/context";
import { db } from "@/kernel/db";
import { evaluateAll } from "@/kernel/flags";
import { appAccessPermission } from "@/kernel/rbac/permissions";
import { installableApps, installedAppIds } from "@/kernel/apps/installs";
import type { AppCardData } from "./components/app-card";

export interface PublishedRequest {
  id: string;
  appId: string;
  name: string;
  purpose: string;
  publishedAt: Date | null;
}

/** Every installable app, annotated for the current user, plus App Builder apps published but not yet deployed. */
export async function loadStore(ctx: KernelContext): Promise<{ apps: AppCardData[]; pending: PublishedRequest[] }> {
  const [installed, flagState, published] = await Promise.all([
    installedAppIds(ctx.user.id),
    evaluateAll(ctx.user),
    db.appRequest.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { id: true, appId: true, name: true, purpose: true, publishedAt: true } }),
  ]);
  const registered = installableApps();
  const apps = registered.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    category: a.category,
    installed: installed.includes(a.id),
    available: ctx.can(appAccessPermission(a.id)) && (!a.featureFlag || !!flagState[a.featureFlag]),
    navLabels: (a.nav ?? []).map((n) => n.label),
  }));
  const pending = published.filter((p) => !registered.some((a) => a.id === p.appId));
  return { apps, pending };
}
