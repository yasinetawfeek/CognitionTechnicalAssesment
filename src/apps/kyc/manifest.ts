import { defineApp } from "@/kernel/apps/types";

/**
 * KYC review queue: onboarding cases are scored by a background job, claimed by reviewers and
 * approved/rejected. High-risk approvals go through the kernel's four-eyes approval flow and
 * anything a reviewer is unsure about can be escalated to a supervisor.
 */
export const kycApp = defineApp({
  id: "kyc",
  name: "KYC Review",
  description: "Review queue for customer onboarding cases",
  icon: "UserCheck",
  category: "operations",
  permissions: [
    { key: "kyc.case.read", description: "View KYC cases" },
    { key: "kyc.case.create", description: "Create cases manually and re-run scoring" },
    { key: "kyc.case.assign", description: "Claim and release cases" },
    { key: "kyc.case.note", description: "Add notes to a case" },
    { key: "kyc.case.decide", description: "Approve or reject a case" },
    { key: "kyc.case.supervise", description: "Approve high-risk decisions (four-eyes) and resolve escalations" },
  ],
  events: [
    { type: "kyc.case.created", description: "A case entered the queue" },
    { type: "kyc.case.scored", description: "The risk model scored a case" },
    { type: "kyc.case.assigned", description: "A case was claimed or released" },
    { type: "kyc.case.escalated", description: "A reviewer escalated a case to supervisors" },
    { type: "kyc.case.decision_requested", description: "A high-risk approval is awaiting a supervisor" },
    { type: "kyc.case.decided", description: "A case was approved or rejected" },
  ],
  nav: [
    { label: "Queue", path: "" },
    { label: "My cases", path: "/mine", permission: "kyc.case.assign" },
    { label: "Stats", path: "/stats" },
  ],
});
