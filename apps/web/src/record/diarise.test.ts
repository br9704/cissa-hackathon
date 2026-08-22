import { describe, it, expect } from "vitest";
import { labelTurns, type DiarisedSegment } from "./diarise";

/*
  labelTurns is the part with real logic and no model in it, so it is the part worth
  testing directly. The models themselves are exercised by using them.
*/
describe("attaching speakers to turns", () => {
  const segments: DiarisedSegment[] = [
    { start: 0, end: 5, cluster: 0 },
    { start: 5, end: 9, cluster: 1 },
    { start: 9, end: 14, cluster: 0 },
  ];

  it("gives a turn the speaker who was talking for most of it", () => {
    const [turn] = labelTurns([{ start: 0, end: 4 }], segments);
    expect(turn!.speaker).toBe("Speaker A");
  });

  it("resolves a turn that straddles a handover by overlap, not by midpoint", () => {
    /*
      4.0 to 6.5 has its midpoint at 5.25, inside cluster 1, but 4.0 to 5.0 is cluster 0
      and 5.0 to 6.5 is cluster 1, so cluster 1 owns 1.5 seconds against 1.0. A midpoint
      test would agree here by luck; shift it to 4.0 to 5.4 and it would not.
    */
    expect(labelTurns([{ start: 4, end: 6.5 }], segments)[0]!.speaker).toBe("Speaker B");
    expect(labelTurns([{ start: 4, end: 5.4 }], segments)[0]!.speaker).toBe("Speaker A");
  });

  it("names clusters A, B, C rather than guessing at people", () => {
    const labelled = labelTurns(
      [{ start: 1, end: 2 }, { start: 6, end: 7 }],
      segments,
    );
    expect(labelled.map((t) => t.speaker)).toEqual(["Speaker A", "Speaker B"]);
  });

  it("says unattributed rather than picking one when nothing overlaps", () => {
    /* Silence, or audio the segmenter found no voice in. Guessing here would put words
       in somebody's mouth, which in a provenance product is the worst available bug. */
    expect(labelTurns([{ start: 40, end: 42 }], segments)[0]!.speaker).toBe("Unattributed");
  });

  it("says unattributed when there are no segments at all", () => {
    expect(labelTurns([{ start: 0, end: 5 }], [])[0]!.speaker).toBe("Unattributed");
  });

  it("keeps the rest of the turn intact", () => {
    const [turn] = labelTurns([{ start: 0, end: 4, text: "the filter is about liquidity" }], segments);
    expect(turn!.text).toBe("the filter is about liquidity");
  });
});
