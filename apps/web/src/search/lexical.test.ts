import { describe, it, expect } from "vitest";
import { tokenize, buildLexicalIndex, bm25, normalise } from "./lexical";

describe("tokenize", () => {
  it("keeps underscored parameter names whole", () => {
    /* vol_filter is one term on this desk. Splitting it turns a precise query vague. */
    expect(tokenize("Raised vol_filter to 0.7")).toContain("vol_filter");
  });

  it("drops filler but keeps negations", () => {
    /* "not" and "no" are the load bearing words in a record of rejected alternatives. */
    const terms = tokenize("this was not the reason and it is no longer true");
    expect(terms).toContain("not");
    expect(terms).toContain("no");
    expect(terms).not.toContain("the");
  });

  it("lowercases and drops single characters", () => {
    expect(tokenize("A B Vol")).toEqual(["vol"]);
  });
});

describe("bm25", () => {
  const docs = [
    "Capped position size in the expiry window after the India flag",
    "Raised vol_filter to 0.7 because realised vol was running high",
    "Moved the roll to the morning session to avoid the close",
    "The expiry window is where most of the risk sits on this book",
  ];
  const index = buildLexicalIndex(docs);

  it("ranks the passage that actually says it first", () => {
    const scores = bm25(index, "why is the expiry window capped");
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    expect(ranked[0]![0]).toBe(0);
  });

  it("returns nothing for a query with no matching terms", () => {
    expect(bm25(index, "quantum entanglement").size).toBe(0);
  });

  it("never scores a term negatively, however common it is", () => {
    /* A term in most documents gets a small idf, not a negative one. Without the +1 in
       the idf a common term pushes down the documents that contain it. */
    const common = buildLexicalIndex(["expiry a", "expiry b", "expiry c", "expiry d"]);
    for (const v of bm25(common, "expiry").values()) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("does not let a long passage win on length alone", () => {
    const padded = buildLexicalIndex([
      "expiry window capped",
      "expiry " + "filler ".repeat(200) + "window capped",
    ]);
    const scores = bm25(padded, "expiry window capped");
    expect(scores.get(0)!).toBeGreaterThan(scores.get(1)!);
  });

  it("saturates repeated terms rather than counting them linearly", () => {
    const rep = buildLexicalIndex(["expiry", "expiry expiry expiry expiry expiry expiry"]);
    const scores = bm25(rep, "expiry");
    /* Six occurrences is more evidence than one, but nowhere near six times as much. */
    const ratio = scores.get(1)! / scores.get(0)!;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(2.5);
  });
});

describe("normalise", () => {
  it("maps the best score to one and leaves ordering intact", () => {
    const out = normalise(new Map([[0, 2], [1, 4], [2, 1]]));
    expect(out.get(1)).toBe(1);
    expect(out.get(0)).toBe(0.5);
  });

  it("handles an empty result set", () => {
    expect(normalise(new Map()).size).toBe(0);
  });
});
