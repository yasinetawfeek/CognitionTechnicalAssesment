import { describe, expect, it } from "vitest";
import { canonicalJson, computeAuditHash, type HashableEntry } from "@/kernel/audit";

const entry: HashableEntry = {
  ts: new Date("2026-01-01T00:00:00Z"),
  actorId: "u1",
  actorEmail: "a@b.c",
  appId: "kyc",
  action: "case.decide",
  targetType: "KycCase",
  targetId: "c1",
  before: { status: "OPEN", b: 1, a: 2 },
  after: { status: "APPROVED" },
  metadata: undefined,
  ip: null,
};

describe("audit hashing", () => {
  it("canonicalJson sorts keys and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: [3, { z: 1, y: undefined }] })).toBe('{"a":[3,{"z":1}],"b":1}');
    expect(canonicalJson(undefined)).toBe("null");
  });
  it("is deterministic regardless of key order", () => {
    const h1 = computeAuditHash("0".repeat(64), entry);
    const h2 = computeAuditHash("0".repeat(64), { ...entry, before: { a: 2, b: 1, status: "OPEN" } });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when previous hash or content changes (chain property)", () => {
    const base = computeAuditHash("0".repeat(64), entry);
    expect(computeAuditHash("1".repeat(64), entry)).not.toBe(base);
    expect(computeAuditHash("0".repeat(64), { ...entry, action: "case.reopen" })).not.toBe(base);
  });
});
