import { describe, it, expect } from "vitest";
import { promoteAnswer, promotedTurns, subscribeToPromotions, allPromotions } from "./promote";

const answer = {
  sessionId: "s1",
  seq: 3,
  title: "Capped position size in the expiry window",
  why: "Two days after the flag we were carrying more into the close than the book holds.",
  strategyId: "strat-1",
  authorMemberId: "daniel",
};

describe("promoting a debrief answer", () => {
  it("returns the same Set between writes", () => {
    /* Same trap the access log fell into: useSyncExternalStore compares snapshots by
       identity, and a fresh Set per call re-renders forever. */
    expect(promotedTurns()).toBe(promotedTurns());
  });

  it("files the answer and marks the turn promoted", () => {
    const before = promotedTurns();
    promoteAnswer(answer);
    expect(promotedTurns()).not.toBe(before);
    expect(promotedTurns().has("s1:3")).toBe(true);
  });

  it("keeps the reasoning verbatim", () => {
    /* Editing the answer on the way through would mean the ledger records what somebody
       wishes had been said. */
    const p = allPromotions().find((x) => x.key === "s1:3")!;
    expect(p.why).toBe(answer.why);
  });

  it("is idempotent, so a double click does not file it twice", () => {
    const first = promoteAnswer({ ...answer, title: "A different title" });
    const count = allPromotions().filter((p) => p.key === "s1:3").length;
    expect(count).toBe(1);
    /* And the original wins rather than the retry silently rewriting it. */
    expect(first.title).toBe(answer.title);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    let calls = 0;
    const off = subscribeToPromotions(() => calls++);
    promoteAnswer({ ...answer, seq: 9 });
    expect(calls).toBe(1);
    off();
    promoteAnswer({ ...answer, seq: 11 });
    expect(calls).toBe(1);
  });

  it("records which turn it came from", () => {
    const p = promoteAnswer({ ...answer, seq: 21 });
    expect(p.sessionId).toBe("s1");
    expect(p.seq).toBe(21);
  });
});
