export const CASE_STATUSES = ["NEW", "IN_REVIEW", "ESCALATED", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const OPEN_STATUSES: CaseStatus[] = ["NEW", "IN_REVIEW", "ESCALATED", "PENDING_APPROVAL"];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const DOCUMENT_TYPES = ["PASSPORT", "NATIONAL_ID", "DRIVING_LICENCE"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface RiskFactor {
  factor: string;
  /** Contribution to the 0..1 score. */
  weight: number;
  detail: string;
}

export interface CaseApprovalPayload {
  caseId: string;
  reference: string;
  applicantName: string;
  riskScore: number | null;
  riskLevel: string | null;
  note: string | null;
}

export const FLAGS = {
  /** When on, the scoring job approves LOW-risk cases without a reviewer. */
  autoApproveLowRisk: "kyc.auto-approve-low-risk",
  /** Shows the per-factor score breakdown on the case page. */
  riskBreakdown: "kyc.risk-breakdown",
} as const;
