import { describe, expect, it } from "vitest";
import { buildMonthGrid, dayKey, monthKey, monthRange, parseMonth, shiftMonth } from "../calendar";
import { countryToRegion, regionCountries, regionLabel } from "../regions";
import { COUNTRY_PATHS } from "../world-map.generated";
import { REGIONS } from "../regions";

describe("calendar month grid", () => {
  it("parses ?month=, falling back to the current month for junk", () => {
    const now = new Date(2026, 2, 15);
    expect(parseMonth("2026-11")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2026-13", now)).toEqual({ year: 2026, month: 2 });
    expect(parseMonth(undefined, now)).toEqual({ year: 2026, month: 2 });
    expect(monthKey(shiftMonth({ year: 2026, month: 11 }, 1))).toBe("2027-01");
  });

  it("starts weeks on Monday and pads with adjacent-month days", () => {
    // 1 March 2026 is a Sunday, so the first week runs 23 Feb – 1 Mar.
    const weeks = buildMonthGrid({ year: 2026, month: 2 });
    expect(weeks[0][0].key).toBe("2026-02-23");
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][6]).toMatchObject({ key: "2026-03-01", inMonth: true });
    expect(weeks.flat()).toHaveLength(weeks.length * 7);
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("stops adding weeks once the month is covered", () => {
    // February 2026 starts on a Sunday and fits in five rows; a leap-free 28-day month
    // starting on Monday fits in exactly four.
    expect(buildMonthGrid({ year: 2026, month: 1 })).toHaveLength(5);
    expect(buildMonthGrid({ year: 2021, month: 1 })).toHaveLength(4);
  });

  it("buckets a due date onto its local day, and month ranges are half-open", () => {
    expect(dayKey(new Date(2026, 2, 9, 23, 30))).toBe("2026-03-09");
    const { start, end } = monthRange({ year: 2026, month: 2 });
    expect(start).toEqual(new Date(2026, 2, 1));
    expect(end).toEqual(new Date(2026, 3, 1));
  });
});

describe("regions", () => {
  it("resolves a country to its narrowest region", () => {
    const map = countryToRegion(["EU", "IE", "GLOBAL"]);
    expect(map.get("IE")).toBe("IE");
    expect(map.get("DE")).toBe("EU");
    expect(map.get("US")).toBeUndefined();
  });

  it("only claims countries whose regions are in play", () => {
    expect(countryToRegion([]).size).toBe(0);
    expect(regionCountries("GLOBAL")).toEqual([]);
    expect(regionLabel("UK")).toBe("United Kingdom");
    expect(regionLabel("MADE_UP")).toBe("MADE_UP");
  });

  it("is drawable: every region has outlines or a pin, except group-wide", () => {
    const missing = REGIONS.flatMap((r) => r.countries).filter((c) => !COUNTRY_PATHS[c]);
    expect(missing).toEqual([]);
    const undrawable = REGIONS.filter((r) => r.key !== "GLOBAL" && r.countries.length === 0 && !r.pin);
    expect(undrawable).toEqual([]);
  });
});
