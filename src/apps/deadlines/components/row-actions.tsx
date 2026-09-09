"use client";

import { InlineAction } from "@/kernel/ui";
import { completeDeadlineAction, deleteDeadlineAction } from "../actions";

export function DeadlineRowActions({ id, status, canComplete, canDelete }: { id: string; status: string; canComplete: boolean; canDelete: boolean }) {
  return (
    <div className="flex justify-end gap-1">
      {canComplete && status === "OPEN" && (
        <InlineAction action={completeDeadlineAction} values={{ id }} size="sm" variant="secondary">
          Mark met
        </InlineAction>
      )}
      {canDelete && (
        <InlineAction action={deleteDeadlineAction} values={{ id }} size="sm" variant="ghost" confirm="Delete this deadline?">
          Delete
        </InlineAction>
      )}
    </div>
  );
}
