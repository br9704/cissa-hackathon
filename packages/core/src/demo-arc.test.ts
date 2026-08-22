import { describe, it, expect } from "vitest";
import { generate, DEFAULT_SEED } from "./seed/generate";
import { scoreStrategy, simulateDeparture } from "./scoring";

/*
  The demo arc, asserted.

  videoscript.md quotes specific numbers on camera, and the honest claims rule says no
  number appears anywhere that a committed artifact cannot back. This file is that
  artifact. If someone tunes the generator and these numbers move, the script is wrong
  and this test says so before a camera is pointed at anything.

  The assertions are ranges rather than exact values where the exact value does not
  matter, and exact where the script says something exact.
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

  it("orphans a substantial body of work across exactly two strategies", () => {
    const { orphanedIds, byStrategy } = simulateDeparture(daniel.id, c.decisions);
    expect(byStrategy.size).toBe(2);
    /* The script says fifty-three. Allow a little movement, and fail loudly if the
       generator ever drifts far enough that the line has to be re-recorded. */
    expect(orphanedIds.length).toBeGreaterThanOrEqual(45);
    expect(orphanedIds.length).toBeLessThanOrEqual(60);
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
