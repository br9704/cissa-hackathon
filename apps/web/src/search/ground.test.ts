import { describe, it, expect } from "vitest";
import { groundAnswer, splitSentences, GROUNDING_FLOOR } from "./ground";

const PASSAGES = [
  "The short window was tracking noise. The longer one lags by about a session and is far more stable across regimes.",
  "Capped position size in the expiry window because liquidity thins out and the fills stopped being representative.",
];

describe("splitSentences", () => {
  it("drops fragments too short to judge", () => {
    expect(splitSentences("Yes. The short window was tracking noise badly.")).toHaveLength(1);
  });
});

describe("groundAnswer", () => {
  it("grounds a sentence the record supports", () => {
    const [claim] = groundAnswer("The short window was tracking noise.", PASSAGES);
    expect(claim!.grounded).toBe(true);
    expect(claim!.support).toContain("tracking noise");
  });

  it("refuses to ground an invention, however fluent", () => {
    /* The dangerous case: plausible, confident, and nowhere in the record. */
    const [claim] = groundAnswer(
      "The committee raised the leverage ceiling to four times after the Basel review.",
      PASSAGES,
    );
    expect(claim!.grounded).toBe(false);
    expect(claim!.support).toBeNull();
  });

  it("judges an answer sentence by sentence, not as a whole", () => {
    /* An answer that is ninety percent right is the one somebody acts on. */
    const claims = groundAnswer(
      "The short window was tracking noise. The committee then raised the leverage ceiling to four times.",
      PASSAGES,
    );
    expect(claims).toHaveLength(2);
    expect(claims[0]!.grounded).toBe(true);
    expect(claims[1]!.grounded).toBe(false);
  });

  it("grounds nothing when there are no passages, rather than everything", () => {
    const claims = groundAnswer("The short window was tracking noise.", []);
    expect(claims.every((c) => !c.grounded)).toBe(true);
  });

  it("uses the same floor as the lexical fallback", () => {
    expect(GROUNDING_FLOOR).toBe(0.6);
  });
});
