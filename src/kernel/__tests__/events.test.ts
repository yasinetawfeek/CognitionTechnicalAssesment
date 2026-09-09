import { describe, expect, it } from "vitest";
import { eventMatches } from "@/kernel/events/bus";

describe("eventMatches", () => {
  it("supports exact, prefix and global patterns", () => {
    expect(eventMatches("flag.updated", "flag.updated")).toBe(true);
    expect(eventMatches("flag.*", "flag.deleted")).toBe(true);
    expect(eventMatches("kyc.*", "kyc.case.decided")).toBe(true);
    expect(eventMatches("*", "anything")).toBe(true);
    expect(eventMatches("flag.*", "flags.updated")).toBe(false);
    expect(eventMatches("flag.updated", "flag.deleted")).toBe(false);
  });
});
