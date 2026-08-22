import { describe, it, expect } from "vitest";
import { generate, DEFAULT_SEED } from "./seed/generate";
import { scoreStrategy, simulateDeparture } from "./scoring";

/*
  The demo arc, asserted.

  This file pins the SHAPE of the story, not the script's numbers. The script is a
  working draft and its figures are illustrative; the data is what it is, and the rule
  that matters is the narrower one: nobody says a number on camera that the screen is not
  showing. So there is no assertion here that the orphan count equals any particular
  value, only that it is large, concentrated in two books, and clearly larger than
  anyone else's.

  What would actually break the demo is the arc going flat: everyone equally exposed, or
  no single point of failure to point at. That is what these assertions catch.
*/
describe("the demo arc holds on the frozen seed", () => {
  const c = generate(DEFAULT_SEED);
  const byName = (n: string) => c.members.find((m) => m.displayName.startsWith(n))!;
  const daniel = byName("Daniel");
  const authors = new Map(c.decisions.map((d) => [d.id, d.authorMemberId]));

  const score = (key: string) => {
    const s = c.strategies.find((x) => x.key === key)!;
    return scoreStrategy({
      strategyId: s.id,
      items: c.decisions
        .filter((d) => d.strategyId === s.id)
        .map((d) => ({ strategyId: s.id, authorMemberId: d.authorMemberId, weight: d.riskFlag ? 2 : 1 })),
      openQuestions: c.questions.filter((q) => q.strategyId === s.id),
      decisionAuthors: authors,
    });
  };

  it("puts Daniel on top of exactly the two books the script names", () => {
    expect(score("india_carry").topHolderMemberId).toBe(daniel.id);
    expect(score("expiry_effects").topHolderMemberId).toBe(daniel.id);
  });

  it("gives his two books a bus factor of one", () => {
    expect(score("india_carry").busFactor).toBe(1);
    expect(score("expiry_effects").busFactor).toBe(1);
  });

  it("keeps the healthy books healthier, so the contrast is real", () => {
    /* Without this the risk board is all red and says nothing. */
    expect(score("vol_filter").busFactor).toBeGreaterThan(1);
    expect(score("basis_roll").busFactor).toBeGreaterThan(1);
    expect(score("vol_filter").concentration).toBeLessThan(score("india_carry").concentration);
  });

  it("orphans a substantial body of work, concentrated in a couple of books", () => {
    const { orphanedIds, byStrategy } = simulateDeparture(daniel.id, c.decisions);
    /* Concentrated, not spread thin across everything: that is what makes it a work
       order rather than a shrug. */
    expect(byStrategy.size).toBeLessThanOrEqual(2);
    /* Large enough to be worth a scene. No upper bound: if the number grows the story
       gets stronger, and the script reads its figures off the screen anyway. */
    expect(orphanedIds.length).toBeGreaterThanOrEqual(30);
  });

  it("makes Daniel clearly the largest single point of failure", () => {
    const others = c.members
      .filter((m) => m.id !== daniel.id)
      .map((m) => simulateDeparture(m.id, c.decisions).orphanedIds.length);
    const his = simulateDeparture(daniel.id, c.decisions).orphanedIds.length;
    /* If anyone else came close, "show me what walks out the door" has the wrong answer. */
    expect(his).toBeGreaterThan(Math.max(...others) * 2);
  });

  it("gives him an exit debrief to sit through", () => {
    const exit = c.sessions.find((s) => s.triggerReason === "exit")!;
    expect(exit.memberId).toBe(daniel.id);
    const turns = c.turns.filter((t) => t.sessionId === exit.id);
    expect(turns.length).toBeGreaterThanOrEqual(8);
  });
});
