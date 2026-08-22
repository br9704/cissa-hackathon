import { describe, it, expect } from "vitest";
import { sentences, fingerprint } from "./recall";

describe("sentence splitting", () => {
  it("does not split a decimal into two sentences", () => {
    /* 0.65 and 0.7 are most of the interesting text in this corpus, and a naive split on
       full stops turns every one of them into two fragments. */
    const out = sentences(
      "We raised it from 0.65 to 0.7 last week. It has held through two flags since.",
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("0.65 to 0.7");
  });

  it("drops a sentence too short to stand on its own as a quote", () => {
    /* "It held." is a real sentence and a useless quotation. The floor exists so an
       answer is made of lines that mean something when read out of context. */
    const out = sentences("The filter is really about liquidity, not vol. It held.");
    expect(out).toHaveLength(1);
  });

  it("splits on a real sentence boundary", () => {
    const out = sentences(
      "The cap is deliberately blunt. It should bind rarely and obviously. Nobody objected.",
    );
    expect(out).toHaveLength(3);
  });

  it("drops fragments too short to be worth quoting", () => {
    expect(sentences("Yes. No. The reasoning is that liquidity dries up at the close.")).toHaveLength(1);
  });

  it("keeps a parenthetical opening as its own sentence", () => {
    const out = sentences("We changed it. (The old value is still in the config.)");
    expect(out).toHaveLength(2);
  });
});

describe("near duplicate fingerprint", () => {
  it("treats two retellings that differ only by a date as the same", () => {
    const a = "Two days after the 20 March flag we were carrying more into the close.";
    const b = "Two days after the 18 March flag we were carrying more into the close.";
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("treats two retellings that differ only by a threshold as the same", () => {
    expect(fingerprint("Raised it to 0.70 after the review."))
      .toBe(fingerprint("Raised it to 0.65 after the review."));
  });

  it("keeps genuinely different sentences apart", () => {
    expect(fingerprint("The cap is deliberately blunt."))
      .not.toBe(fingerprint("The filter is about liquidity, not vol."));
  });

  it("is insensitive to case and punctuation but not to words", () => {
    expect(fingerprint("The cap is blunt!")).toBe(fingerprint("the cap is blunt"));
    expect(fingerprint("The cap is blunt")).not.toBe(fingerprint("The cap is sharp"));
  });
});
