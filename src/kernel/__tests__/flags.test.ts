import { describe, expect, it } from "vitest";
import { evaluateFlag, type FlagRecord } from "@/kernel/flags";

const flag = (over: Partial<FlagRecord>): FlagRecord => ({ key: "k", description: "", enabled: true, rules: null, ownerAppId: "kernel", ...over });
const alice = { id: "u-alice", email: "Alice@Demo.local", roles: [{ id: "r1", key: "engineer", name: "Engineer" }] };

describe("evaluateFlag", () => {
  it("disabled or missing flags are off", () => {
    expect(evaluateFlag(undefined, alice)).toBe(false);
    expect(evaluateFlag(flag({ enabled: false }), alice)).toBe(false);
  });
  it("no rules = on for everyone, including anonymous", () => {
    expect(evaluateFlag(flag({}), alice)).toBe(true);
    expect(evaluateFlag(flag({}), null)).toBe(true);
  });
  it("targets users (case-insensitive) and roles", () => {
    expect(evaluateFlag(flag({ rules: { users: ["alice@demo.local"] } }), alice)).toBe(true);
    expect(evaluateFlag(flag({ rules: { users: ["bob@demo.local"] } }), alice)).toBe(false);
    expect(evaluateFlag(flag({ rules: { roles: ["engineer"] } }), alice)).toBe(true);
    expect(evaluateFlag(flag({ rules: { roles: ["admin"] } }), alice)).toBe(false);
    expect(evaluateFlag(flag({ rules: { roles: ["admin"] } }), null)).toBe(false);
  });
  it("percentage rollout is stable per user and respects bounds", () => {
    const f = flag({ rules: { percentage: 50 } });
    expect(evaluateFlag(f, alice)).toBe(evaluateFlag(f, alice));
    expect(evaluateFlag(flag({ rules: { percentage: 100 } }), alice)).toBe(true);
    expect(evaluateFlag(flag({ rules: { percentage: 0 } }), alice)).toBe(false);
    const on = Array.from({ length: 1000 }, (_, i) => evaluateFlag(f, { ...alice, id: `u${i}` })).filter(Boolean).length;
    expect(on).toBeGreaterThan(400);
    expect(on).toBeLessThan(600);
  });
});
