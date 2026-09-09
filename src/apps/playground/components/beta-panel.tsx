"use client";

import { Badge, Card, CardBody, CardHeader } from "@/kernel/ui";
import { useFlag } from "@/kernel/flags/client";

/**
 * Demonstrates cross-app flag propagation: flip `playground.beta-panel` in System → Feature flags
 * (or via the future Feature Flag Admin app) and this card appears/disappears here with no reload.
 */
export function BetaPanel({ serverEnabled }: { serverEnabled: boolean }) {
  const enabled = useFlag("playground.beta-panel");
  return (
    <Card>
      <CardHeader
        title="Flag-gated panel"
        actions={<Badge tone={enabled ? "success" : "neutral"}>{enabled ? "ON" : "OFF"}</Badge>}
      />
      <CardBody className="text-sm">
        {enabled ? (
          <p>
            You can see this because <span className="font-mono text-xs">playground.beta-panel</span> is enabled for you. Toggle it in{" "}
            <span className="font-medium">System → Feature flags</span> and this card updates instantly via the event stream.
          </p>
        ) : (
          <p className="text-muted">
            Hidden content. Enable <span className="font-mono text-xs">playground.beta-panel</span> in System → Feature flags to reveal it — no reload needed.
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          Server rendered it as {serverEnabled ? "ON" : "OFF"}; client now says {enabled ? "ON" : "OFF"}.
        </p>
      </CardBody>
    </Card>
  );
}
