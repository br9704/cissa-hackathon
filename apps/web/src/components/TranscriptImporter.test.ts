import { describe, it, expect } from "vitest";
import { parseTranscript } from "./TranscriptImporter";

describe("transcript parsing", () => {
  it("reads the plain Name: text shape", () => {
    const out = parseTranscript("Marcus: The book is fine.\nDaniel: It is not.");
    expect(out).toEqual([
      { speaker: "Marcus", text: "The book is fine." },
      { speaker: "Daniel", text: "It is not." },
    ]);
  });

  it("strips a leading timestamp in brackets or parentheses", () => {
    const out = parseTranscript("[00:04:12] Marcus: Yes.\n(01:02) Daniel: No, and here is why.");
    expect(out[0]).toEqual({ speaker: "Marcus", text: "Yes." });
    expect(out[1]!.speaker).toBe("Daniel");
  });

  it("attaches a wrapped line to the speaker above it", () => {
    /* Almost every real transcript wraps, and a parser that drops the continuation loses
       the half of the sentence that carries the reasoning. */
    const out = parseTranscript(
      "Daniel: It is doing liquidity work.\nOn a quiet expiry it reads fine.",
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe("It is doing liquidity work. On a quiet expiry it reads fine.");
  });

  it("handles a full name with a middle initial", () => {
    const out = parseTranscript("Daniel A. Okonkwo: The cap is blunt on purpose.");
    expect(out[0]!.speaker).toBe("Daniel A. Okonkwo");
  });

  it("does not mistake a sentence containing a colon for a speaker line", () => {
    /* "The rule is simple: cut size" is not a speaker named "The rule is simple", and
       silently reassigning it would attribute somebody's words to a person who does not
       exist. */
    const out = parseTranscript("Marcus: The rule is simple: cut size before you widen.");
    expect(out).toHaveLength(1);
    expect(out[0]!.speaker).toBe("Marcus");
    expect(out[0]!.text).toBe("The rule is simple: cut size before you widen.");
  });

  it("drops a leading continuation with no speaker rather than inventing one", () => {
    const out = parseTranscript("some text with no speaker\nMarcus: Now there is one.");
    expect(out).toHaveLength(1);
    expect(out[0]!.speaker).toBe("Marcus");
  });

  it("ignores blank lines", () => {
    expect(parseTranscript("\n\nMarcus: One.\n\n\nDaniel: Two.\n\n")).toHaveLength(2);
  });

  it("returns nothing for an empty transcript", () => {
    expect(parseTranscript("")).toEqual([]);
  });
});
