import type { RiskFactor, RiskLevel } from "./types";

/**
 * Stand-in for the KYC outlier-detection model. Pure and deterministic so it is unit-testable;
 * the `kyc.score-case` job feeds it a case plus the deposits of the rest of the population.
 * Swapping in a real model means replacing this function body with an HTTP call.
 */

export interface ScoringInput {
  country: string;
  dateOfBirth: Date;
  documentType: string;
  declaredIncome: number;
  initialDeposit: number;
  pepMatch: boolean;
  sanctionsHit: boolean;
}

export interface ScoringResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

/** Demo list only — a real deployment would source this from compliance. */
export const HIGH_RISK_COUNTRIES = new Set(["IR", "KP", "MM", "SY", "YE", "AF", "SS"]);
export const ELEVATED_RISK_COUNTRIES = new Set(["RU", "BY", "VE", "NG", "PK", "PA", "KY", "VG"]);

export const HIGH_RISK_THRESHOLD = 0.66;
export const MEDIUM_RISK_THRESHOLD = 0.33;

export function riskLevel(score: number): RiskLevel {
  if (score >= HIGH_RISK_THRESHOLD) return "HIGH";
  if (score >= MEDIUM_RISK_THRESHOLD) return "MEDIUM";
  return "LOW";
}

export function ageAt(dateOfBirth: Date, at: Date): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (at.getUTCMonth() === dateOfBirth.getUTCMonth() && at.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function scoreCase(input: ScoringInput, populationDeposits: number[], now = new Date()): ScoringResult {
  const factors: RiskFactor[] = [];

  if (input.sanctionsHit) {
    factors.push({ factor: "sanctions", weight: 1, detail: "Name matched a sanctions list" });
  }
  if (input.pepMatch) {
    factors.push({ factor: "pep", weight: 0.4, detail: "Politically exposed person match" });
  }

  const country = input.country.toUpperCase();
  if (HIGH_RISK_COUNTRIES.has(country)) {
    factors.push({ factor: "country", weight: 0.5, detail: `${country} is a high-risk jurisdiction` });
  } else if (ELEVATED_RISK_COUNTRIES.has(country)) {
    factors.push({ factor: "country", weight: 0.2, detail: `${country} is an elevated-risk jurisdiction` });
  }

  const ratio = input.declaredIncome > 0 ? input.initialDeposit / input.declaredIncome : Infinity;
  if (ratio >= 1) {
    factors.push({ factor: "deposit_vs_income", weight: 0.35, detail: `Initial deposit is ${ratio === Infinity ? "unbounded" : `${ratio.toFixed(1)}×`} the declared annual income` });
  } else if (ratio >= 0.5) {
    factors.push({ factor: "deposit_vs_income", weight: 0.15, detail: `Initial deposit is ${(ratio * 100).toFixed(0)}% of declared annual income` });
  }

  if (populationDeposits.length >= 3) {
    const mean = populationDeposits.reduce((a, b) => a + b, 0) / populationDeposits.length;
    const variance = populationDeposits.reduce((a, b) => a + (b - mean) ** 2, 0) / populationDeposits.length;
    const sd = Math.sqrt(variance) || 1;
    const z = (input.initialDeposit - mean) / sd;
    if (z >= 3) {
      factors.push({ factor: "deposit_outlier", weight: 0.3, detail: `Deposit is ${z.toFixed(1)}σ above the population mean` });
    } else if (z >= 2) {
      factors.push({ factor: "deposit_outlier", weight: 0.15, detail: `Deposit is ${z.toFixed(1)}σ above the population mean` });
    }
  }

  const age = ageAt(input.dateOfBirth, now);
  if (age < 18) {
    factors.push({ factor: "age", weight: 0.5, detail: `Applicant is ${age} — under the minimum age` });
  } else if (age < 21) {
    factors.push({ factor: "age", weight: 0.1, detail: `Applicant is ${age}` });
  }

  if (input.documentType === "DRIVING_LICENCE") {
    factors.push({ factor: "document", weight: 0.05, detail: "Driving licence is a weaker identity document" });
  }

  const raw = factors.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round(Math.min(1, raw) * 100) / 100;
  return { score, level: riskLevel(score), factors };
}
