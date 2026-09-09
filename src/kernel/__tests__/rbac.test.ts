import { describe, expect, it } from "vitest";
import { appAccessPermission, hasPermission, isValidPermission, permissionMatches } from "@/kernel/rbac/permissions";

describe("permissionMatches", () => {
  it("matches exact and global wildcard", () => {
    expect(permissionMatches("kyc.case.read", "kyc.case.read")).toBe(true);
    expect(permissionMatches("*", "anything.at.all")).toBe(true);
    expect(permissionMatches("kyc.case.read", "kyc.case.write")).toBe(false);
  });
  it("matches prefix wildcards only on dot boundaries", () => {
    expect(permissionMatches("kyc.*", "kyc.case.read")).toBe(true);
    expect(permissionMatches("kyc.case.*", "kyc.case.read")).toBe(true);
    expect(permissionMatches("kyc.*", "kycx.case.read")).toBe(false);
    expect(permissionMatches("kyc.case.*", "kyc.other")).toBe(false);
  });
  it("hasPermission checks any granted", () => {
    expect(hasPermission(["audit.access", "kyc.*"], "kyc.case.approve")).toBe(true);
    expect(hasPermission(["audit.access"], "kyc.case.approve")).toBe(false);
    expect(hasPermission([], "x")).toBe(false);
  });
  it("app access permission + validation", () => {
    expect(appAccessPermission("kyc")).toBe("kyc.access");
    expect(isValidPermission("kyc.case.read")).toBe(true);
    expect(isValidPermission("kyc.*")).toBe(true);
    expect(isValidPermission("*")).toBe(true);
    expect(isValidPermission("Kyc.Case")).toBe(false);
    expect(isValidPermission("kyc..x")).toBe(false);
  });
});
