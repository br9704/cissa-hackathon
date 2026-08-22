import { describe, it, expect } from "vitest";
import {
  busFactor, herfindahl, vacationReadiness, scoreStrategy, simulateDeparture,
  departureExposure, type StrategyScore,
} from "./scoring";

const item = (author: string, weight = 1) => ({ strategyId: "s", authorMemberId: author, weight });

describe("herfindahl concentration", () => {
  it("is 1 when one person wrote everything", () => {
    expect(herfindahl([item("a"), item("a"), item("a")])).toBeCloseTo(1);
  });

  it("falls as authorship spreads out", () => {
    const two = herfindahl([item("a"), item("b")]);
    const four = herfindahl([item("a"), item("b"), item("c"), item("d")]);
    expect(two).toBeCloseTo(0.5);
    expect(four).toBeCloseTo(0.25);
    expect(four).toBeLessThan(two);
  });

  it("distinguishes a strong pair from one holder with a long tail", () => {
    const pair = herfindahl([item("a", 5), item("b", 5)]);
    const tail = herfindahl([item("a", 8), item("b"), item("c"), item("d")]);
    /* Both have two or more contributors. Only one of them is actually spread. */
    expect(tail).toBeGreaterThan(pair);
  });

  it("is 0 for no items rather than dividing by zero", () => {
    expect(herfindahl([])).toBe(0);
  });
});

describe("bus factor", () => {
  it("is 1 when one person holds the majority", () => {
    expect(busFactor([item("a", 7), item("b"), item("c"), item("d")])).toBe(1);
  });

  it("is 2 when it takes two people to pass half", () => {
    expect(busFactor([item("a", 4), item("b", 4), item("c"), item("d")])).toBe(2);
  });

  it("is 0 for an empty strategy", () => {
    expect(busFactor([])).toBe(0);
  });

  it("never exceeds the number of contributors", () => {
    /* An even split of four is the case where a naive loop can run off the end. */
    expect(busFactor([item("a"), item("b"), item("c"), item("d")])).toBeLessThanOrEqual(4);
  });
});

describe("vacation readiness", () => {
  const authors = new Map([["d1", "alice"], ["d2", "bob"]]);

  it("is 100 with no open questions, and says so in the breakdown", () => {
    const r = vacationReadiness([], authors, "alice");
    expect(r.score).toBe(100);
    expect(r.total).toBe(0);
  });

  it("drops when the masked member is the only one who answered", () => {
    const qs = [{ answeredByDecisionId: "d1" }, { answeredByDecisionId: "d1" }];
    expect(vacationReadiness(qs, authors, "alice").score).toBe(0);
    expect(vacationReadiness(qs, authors, "bob").score).toBe(100);
  });

  it("counts an unanswered question as answerable by nobody", () => {
    const qs = [{ answeredByDecisionId: null }, { answeredByDecisionId: "d2" }];
    expect(vacationReadiness(qs, authors, "alice").score).toBe(50);
  });
});

describe("scoreStrategy", () => {
  it("names a top holder without ever producing a per person score", () => {
    const score = scoreStrategy({
      strategyId: "s",
      items: [item("alice", 6), item("bob", 2), item("carol", 2)],
      openQuestions: [{ answeredByDecisionId: "d1" }],
      decisionAuthors: new Map([["d1", "alice"]]),
    });
    expect(score.topHolderMemberId).toBe("alice");
    expect(score.busFactor).toBe(1);
    expect(score.vacationReadiness).toBe(0);
    /* The shape of the result is part of the contract: strategy level only. */
    expect(score).not.toHaveProperty("memberScores");
    expect(Object.keys(score)).toContain("strategyId");
  });
});

describe("departure simulation", () => {
  const decisions = [
    { id: "1", strategyId: "s1", authorMemberId: "daniel", tags: ["s1", "expiry_cap"], title: "a", riskFlag: true },
    { id: "2", strategyId: "s1", authorMemberId: "daniel", tags: ["s1", "vol_filter"], title: "b", riskFlag: false },
    { id: "3", strategyId: "s1", authorMemberId: "priya", tags: ["s1", "vol_filter"], title: "c", riskFlag: false },
    { id: "4", strategyId: "s2", authorMemberId: "priya", tags: ["s2", "roll_window"], title: "d", riskFlag: false },
  ];

  it("orphans only the ground nobody else has touched", () => {
    const { orphanedIds, byStrategy } = simulateDeparture("daniel", decisions);
    /* Decision 2 is covered: Priya has also worked on vol_filter in the same strategy.
       Decision 1 is not, so it is the one that walks out the door. */
    expect(orphanedIds).toEqual(["1"]);
    expect(byStrategy.get("s1")).toBe(1);
  });

  it("orphans nothing when the member authored nothing", () => {
    expect(simulateDeparture("nobody", decisions).orphanedIds).toEqual([]);
  });

  it("does not count coverage across strategy boundaries", () => {
    /* Same tag, different book, is not the same ground. This is the assertion that stops
       the simulation quietly under reporting risk on a firm with shared parameter names. */
    const crossed = [
      { id: "1", strategyId: "s1", authorMemberId: "daniel", tags: ["vol_filter"], title: "a", riskFlag: false },
      { id: "2", strategyId: "s2", authorMemberId: "priya", tags: ["vol_filter"], title: "b", riskFlag: false },
    ];
    expect(simulateDeparture("daniel", crossed).orphanedIds).toEqual(["1"]);
  });
});

describe("departure exposure", () => {
  const strategies = [
    { id: "s1", name: "India options carry", revenueUsdM: 214 },
    { id: "s2", name: "Expiry window effects", revenueUsdM: 148 },
    { id: "s3", name: "Cross asset vol filter", revenueUsdM: 96 },
    { id: "s4", name: "Futures basis roll", revenueUsdM: 0 },
  ];

  const score = (top: string | null, bus: number): StrategyScore => ({
    strategyId: "x",
    busFactor: bus,
    concentration: 0.8,
    vacationReadiness: 50,
    topHolderMemberId: top,
    breakdown: { totalItems: 0, contributors: 0, shares: [], openQuestions: 0, answerableWithoutTopHolder: 0 },
  });

  const scores = new Map([
    ["s1", score("daniel", 1)],
    ["s2", score("daniel", 1)],
    ["s3", score("priya", 2)],
    ["s4", score("marcus", 2)],
  ]);

  it("sums only the books where one person holds it alone", () => {
    const out = departureExposure("daniel", strategies, scores);
    expect(out.exposedUsdM).toBe(214 + 148);
    expect(out.exposed.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("counts a book with a real second author separately rather than folding it in", () => {
    /* Rolling partial into the headline would let a book that is genuinely covered
       inflate the number, which is the easiest way to overstate a dollar figure. */
    const out = departureExposure("priya", strategies, scores);
    expect(out.exposedUsdM).toBe(0);
    expect(out.partialUsdM).toBe(96);
  });

  it("ignores a strategy earning nothing", () => {
    /* The paper book. A zero here is what stops the maths assuming every strategy has
       revenue attached. */
    const out = departureExposure("marcus", strategies, scores);
    expect(out.exposedUsdM).toBe(0);
    expect(out.partialUsdM).toBe(0);
  });

  it("exposes nothing for somebody who holds nothing", () => {
    expect(departureExposure("elena", strategies, scores).exposedUsdM).toBe(0);
  });

  it("never exceeds the firm total", () => {
    for (const who of ["daniel", "priya", "marcus", "elena"]) {
      const out = departureExposure(who, strategies, scores);
      expect(out.exposedUsdM + out.partialUsdM).toBeLessThanOrEqual(out.totalUsdM);
    }
  });
});
