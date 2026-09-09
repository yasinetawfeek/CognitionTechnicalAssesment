import type { Tone } from "@/kernel/ui/primitives";

export const STATUS_ORDER = ["QUEUED", "BUILDING", "READY_FOR_TESTING", "IN_REVIEW", "PUBLISHED"] as const;

export function statusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

export function requestTone(status: string): Tone {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "BUILDING":
    case "IN_REVIEW":
      return "warning";
    case "READY_FOR_TESTING":
      return "info";
    case "REJECTED":
    case "FAILED":
      return "danger";
    default:
      return "neutral";
  }
}
