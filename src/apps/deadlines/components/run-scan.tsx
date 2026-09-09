"use client";

import { InlineAction } from "@/kernel/ui";
import { runReminderScanAction } from "../actions";

export function RunScanButton() {
  return (
    <InlineAction action={runReminderScanAction} variant="secondary">
      Run reminder scan
    </InlineAction>
  );
}
