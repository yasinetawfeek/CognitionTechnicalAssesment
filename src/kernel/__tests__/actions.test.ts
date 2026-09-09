import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formField, parseForm, toActionError } from "@/kernel/actions";
import { ForbiddenError, ValidationError } from "@/kernel/errors";

const fd = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

describe("parseForm", () => {
  it("parses scalars, checkboxes, numbers and repeated keys", () => {
    const schema = z.object({ name: z.string(), on: formField.checkbox, n: formField.number, perms: formField.list, tags: formField.list });
    const out = parseForm(schema, fd([["name", "x"], ["on", "on"], ["n", "42"], ["perms", "a"], ["perms", "b"], ["tags[]", "t"], ["$ACTION_ID", "ignored"]]));
    expect(out).toEqual({ name: "x", on: true, n: 42, perms: ["a", "b"], tags: ["t"] });
  });
  it("throws ValidationError with per-field issues", () => {
    expect(() => parseForm(z.object({ email: z.string().email() }), fd([["email", "nope"]]))).toThrowError(ValidationError);
    try {
      parseForm(z.object({ email: z.string().email() }), fd([["email", "nope"]]));
    } catch (e) {
      expect((e as ValidationError).issues.email?.length).toBe(1);
    }
  });
  it("maps kernel errors to action states", () => {
    expect(toActionError(new ForbiddenError("kyc.x"))).toMatchObject({ ok: false });
    expect(toActionError(new Error("boom")).ok).toBe(false);
  });
});
