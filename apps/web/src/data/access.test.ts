import { describe, it, expect } from "vitest";
import { accessLog, recordAccess, subscribeToAccessLog } from "./access";

describe("the access log as an external store", () => {
  it("returns the SAME array between writes", () => {
    /*
      The assertion that matters, and the one whose absence produced a blank page.
      useSyncExternalStore compares snapshots by identity, so a getSnapshot that builds a
      new array every call re-renders forever and the error points at React rather than
      at the store.
    */
    const a = accessLog();
    const b = accessLog();
    expect(a).toBe(b);
  });

  it("returns a new array after a write, so React actually re-renders", () => {
    const before = accessLog();
    recordAccess({
      kind: "access_export",
      actorMemberId: "m1",
      target: "Handover pack",
      subjectMemberIds: ["m2"],
      justification: "regulatory request",
    });
    expect(accessLog()).not.toBe(before);
  });

  it("puts the newest event first", () => {
    recordAccess({ kind: "access_read", actorMemberId: "m1", target: "first", subjectMemberIds: [] });
    recordAccess({ kind: "access_read", actorMemberId: "m1", target: "second", subjectMemberIds: [] });
    expect(accessLog()[0]!.target).toBe("second");
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    let calls = 0;
    const off = subscribeToAccessLog(() => calls++);
    recordAccess({ kind: "access_read", actorMemberId: "m1", target: "x", subjectMemberIds: [] });
    expect(calls).toBe(1);
    off();
    recordAccess({ kind: "access_read", actorMemberId: "m1", target: "y", subjectMemberIds: [] });
    expect(calls).toBe(1);
  });

  it("keeps the justification on an export and leaves reads without one", () => {
    const exported = recordAccess({
      kind: "access_export", actorMemberId: "m1", target: "pack",
      subjectMemberIds: ["m2"], justification: "onboarding a successor",
    });
    const read = recordAccess({
      kind: "access_read", actorMemberId: "m1", target: "strategy", subjectMemberIds: ["m2"],
    });
    expect(exported.justification).toBe("onboarding a successor");
    expect(read.justification).toBeUndefined();
  });
});
