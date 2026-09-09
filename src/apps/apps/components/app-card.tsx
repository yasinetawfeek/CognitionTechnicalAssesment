"use client";

import Link from "next/link";
import { Badge, buttonClass, Card, CardBody, Icon, InlineAction } from "@/kernel/ui";
import { installAppAction, uninstallAppAction } from "../actions";

export interface AppCardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  installed: boolean;
  /** User holds `<id>.access` (and the app's feature flag, if any). */
  available: boolean;
  navLabels?: string[];
}

export function AppCard({ app, mode }: { app: AppCardData; mode: "store" | "mine" }) {
  return (
    <Card className={app.available ? "h-full" : "h-full opacity-70"}>
      <CardBody className="flex h-full flex-col">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft">
              <Icon name={app.icon} className="h-5 w-5 text-primary" />
            </span>
            <div>
              <p className="font-medium leading-tight">{app.name}</p>
              <p className="font-mono text-[11px] text-muted">/{app.id}</p>
            </div>
          </div>
          <Badge>{app.category}</Badge>
        </div>
        <p className="flex-1 text-sm text-muted">{app.description}</p>
        {app.navLabels && app.navLabels.length > 0 && (
          <p className="mt-2 text-xs text-muted">Includes: {app.navLabels.join(" · ")}</p>
        )}
        <div className="mt-4 flex items-center gap-2">
          {mode === "mine" || app.installed ? (
            <>
              <Link href={`/${app.id}`} className={buttonClass("primary", "sm")}>
                Open
              </Link>
              <InlineAction action={uninstallAppAction} values={{ appId: app.id }} variant="ghost" size="sm" confirm={`Remove ${app.name} from My apps?`}>
                Uninstall
              </InlineAction>
            </>
          ) : app.available ? (
            <InlineAction action={installAppAction} values={{ appId: app.id }} variant="primary" size="sm">
              Install
            </InlineAction>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Icon name="Lock" className="h-3.5 w-3.5" /> Ask an admin for <code className="font-mono">{app.id}.access</code>
            </span>
          )}
          {app.installed && mode === "store" && <Badge tone="success">Installed</Badge>}
        </div>
      </CardBody>
    </Card>
  );
}
