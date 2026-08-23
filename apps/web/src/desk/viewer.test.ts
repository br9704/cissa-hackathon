import { describe, it, expect } from "vitest";
import { SECTIONS, ROLE_LABEL, ROLE_LEDE, type Role } from "./viewer";

const ROLES: Role[] = ["desk_head", "researcher", "compliance", "newcomer"];

describe("role surfaces", () => {
  it("gives every role a distinct opening order", () => {
    const orders = ROLES.map((r) => SECTIONS[r].join(","));
    expect(new Set(orders).size).toBe(ROLES.length);
  });

  it("opens the newcomer on the curriculum, which is the whole second argument", () => {
    expect(SECTIONS.newcomer[0]).toBe("curriculum");
  });

  it("opens compliance on the chain rather than on money", () => {
    expect(SECTIONS.compliance[0]).toBe("chain_state");
  });

  it("labels and describes every role", () => {
    for (const r of ROLES) {
      expect(ROLE_LABEL[r]).toBeTruthy();
      expect(ROLE_LEDE[r].length).toBeGreaterThan(20);
    }
  });

  it("gates nothing: every section is reachable by some role", () => {
    /* Role orders the surface, it never restricts it. A section only one role can see would
       be a permission, and permissions here would be theatre: the data is in the browser. */
    const all = new Set(ROLES.flatMap((r) => SECTIONS[r]));
    expect(all.size).toBeGreaterThanOrEqual(6);
  });
});
