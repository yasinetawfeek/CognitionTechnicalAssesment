import { describe, expect, it } from "vitest";
import { canSeeDeadline, parseList, serializeList, visibilityWhere, type Viewer } from "../visibility";
import { DAY_MS, shouldNotify, stageFor } from "../reminders";

const analyst: Viewer = { id: "u-analyst", roleKeys: ["finance_analyst"], permissions: ["deadlines.access"] };
const counsel: Viewer = { id: "u-counsel", roleKeys: ["legal_counsel"], permissions: ["deadlines.access"] };
const controller: Viewer = { id: "u-controller", roleKeys: ["finance_controller"], permissions: ["deadlines.access", "deadlines.deadline.viewall"] };
const outsider: Viewer = { id: "u-outsider", roleKeys: ["engineer"], permissions: ["playground.access"] };

const everyone = { ownerId: "u-controller", visibility: "EVERYONE", visibleRoles: "", visibleUsers: "" };
const roleScoped = { ownerId: "u-controller", visibility: "ROLES", visibleRoles: serializeList(["finance_analyst"]), visibleUsers: "" };
const userScoped = { ownerId: "u-counsel", visibility: "USERS", visibleRoles: "", visibleUsers: serializeList(["u-analyst"]) };

describe("deadline visibility", () => {
  it("serialises lists pipe-delimited so SQLite `contains` cannot match partial ids", () => {
    expect(serializeList(["a", "b", "a", " "])).toBe("|a|b|");
    expect(serializeList([])).toBe("");
    expect(parseList("|a|b|")).toEqual(["a", "b"]);
  });

  it("shows EVERYONE deadlines to any user with app access, but not to users without it", () => {
    expect(canSeeDeadline(analyst, everyone)).toBe(true);
    expect(canSeeDeadline(outsider, everyone)).toBe(false);
  });

  it("limits role-scoped deadlines to the listed roles", () => {
    expect(canSeeDeadline(analyst, roleScoped)).toBe(true);
    expect(canSeeDeadline(counsel, roleScoped)).toBe(false);
  });

  it("limits user-scoped deadlines to the named people and the owner", () => {
    expect(canSeeDeadline(analyst, userScoped)).toBe(true);
    expect(canSeeDeadline(counsel, userScoped)).toBe(true); // owner
    expect(canSeeDeadline({ ...analyst, id: "u-other" }, userScoped)).toBe(false);
  });

  it("lets viewall holders see everything and drops the query filter for them", () => {
    expect(canSeeDeadline(controller, roleScoped)).toBe(true);
    expect(visibilityWhere(controller)).toEqual({});
    expect(visibilityWhere(analyst).OR).toHaveLength(4);
  });
});

describe("reminder stages", () => {
  const now = new Date("2026-03-01T09:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * DAY_MS);

  it("maps time-to-due onto stages", () => {
    expect(stageFor(at(30), now)).toBeNull();
    expect(stageFor(at(10), now)).toBe("T14");
    expect(stageFor(at(3), now)).toBe("T7");
    expect(stageFor(at(0.5), now)).toBe("T1");
    expect(stageFor(at(-1), now)).toBe("OVERDUE");
  });

  it("notifies each stage at most once, and only when the stage advances", () => {
    expect(shouldNotify("T7", null)).toBe(true);
    expect(shouldNotify("T7", "T7")).toBe(false);
    expect(shouldNotify("T7", "T14")).toBe(true);
    expect(shouldNotify("T7", "T1")).toBe(false);
    expect(shouldNotify(null, null)).toBe(false);
  });
});
