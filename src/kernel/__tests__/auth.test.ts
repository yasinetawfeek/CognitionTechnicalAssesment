import { describe, expect, it } from "vitest";
import { safeNext } from "@/kernel/auth";

describe("safeNext", () => {
  it("only allows same-origin relative paths", () => {
    expect(safeNext("/kyc?x=1")).toBe("/kyc?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
