import { statusTone, type Tone } from "@/kernel/ui";

export function riskTone(level: string | null): Tone {
  if (level === "HIGH") return "danger";
  if (level === "MEDIUM") return "warning";
  if (level === "LOW") return "success";
  return "neutral";
}

export function caseStatusTone(status: string): Tone {
  if (status === "ESCALATED") return "danger";
  if (status === "IN_REVIEW") return "info";
  if (status === "NEW") return "primary";
  return statusTone(status);
}
