import { describe, expect, it } from "vitest";
import { ageAt, riskLevel, scoreCase, type ScoringInput } from "./scoring";

const NOW = new Date("2026-01-01T00:00:00Z");

const clean: ScoringInput = {
  country: "GB",
  dateOfBirth: new Date("1988-04-12"),
  documentType: "PASSPORT",
  declaredIncome: 52000,
  initialDeposit: 1500,
  pepMatch: false,
  sanctionsHit: false,
};

const population = [1500, 800, 3200, 900, 2000, 4000, 1200, 2500];

describe("kyc scoring", () => {
  it("scores a clean applicant as LOW with no factors", () => {
    const r = scoreCase(clean, population, NOW);
    expect(r.score).toBe(0);
    expect(r.level).toBe("LOW");
    expect(r.factors).toEqual([]);
  });

  it("a sanctions hit alone is HIGH", () => {
    const r = scoreCase({ ...clean, sanctionsHit: true }, population, NOW);
    expect(r.score).toBe(1);
    expect(r.level).toBe("HIGH");
    expect(r.factors.map((f) => f.factor)).toContain("sanctions");
  });

  it("stacks jurisdiction, PEP and deposit factors and caps at 1", () => {
    const r = scoreCase({ ...clean, country: "ir", pepMatch: true, declaredIncome: 40000, initialDeposit: 120000 }, population, NOW);
    expect(r.factors.map((f) => f.factor).sort()).toEqual(["country", "deposit_outlier", "deposit_vs_income", "pep"]);
    expect(r.score).toBe(1);
    expect(r.level).toBe("HIGH");
  });

  it("flags a deposit that is an outlier against the population", () => {
    const r = scoreCase({ ...clean, declaredIncome: 500000, initialDeposit: 30000 }, population, NOW);
    const outlier = r.factors.find((f) => f.factor === "deposit_outlier");
    expect(outlier?.weight).toBe(0.3);
    expect(r.factors.some((f) => f.factor === "deposit_vs_income")).toBe(false);
  });

  it("needs at least three peers before using the outlier check", () => {
    const r = scoreCase({ ...clean, declaredIncome: 500000, initialDeposit: 30000 }, [100, 200], NOW);
    expect(r.factors.some((f) => f.factor === "deposit_outlier")).toBe(false);
  });

  it("under-age applicants are flagged", () => {
    const r = scoreCase({ ...clean, dateOfBirth: new Date("2010-06-01") }, population, NOW);
    expect(r.factors.find((f) => f.factor === "age")?.weight).toBe(0.5);
    expect(r.level).toBe("MEDIUM");
  });

  it("maps scores to levels at the documented thresholds", () => {
    expect(riskLevel(0)).toBe("LOW");
    expect(riskLevel(0.32)).toBe("LOW");
    expect(riskLevel(0.33)).toBe("MEDIUM");
    expect(riskLevel(0.65)).toBe("MEDIUM");
    expect(riskLevel(0.66)).toBe("HIGH");
  });

  it("computes age respecting the birthday", () => {
    expect(ageAt(new Date("2000-06-15"), new Date("2026-06-14"))).toBe(25);
    expect(ageAt(new Date("2000-06-15"), new Date("2026-06-15"))).toBe(26);
  });
});
