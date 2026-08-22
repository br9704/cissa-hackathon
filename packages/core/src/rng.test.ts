import { describe, it, expect } from "vitest";
import { makeRng, makeUuid } from "./rng";

describe("seeded rng", () => {
  it("produces the same stream from the same seed", () => {
    const a = makeRng(20260822);
    const b = makeRng(20260822);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces a different stream from a different seed", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("shuffles without mutating the input", () => {
    const input = Object.freeze([1, 2, 3, 4, 5]);
    const rng = makeRng(7);
    /* Object.freeze means an in place shuffle throws rather than passing quietly. */
    expect(() => rng.shuffle(input)).not.toThrow();
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("generates uuid shaped ids that are stable and unique within a run", () => {
    const ids = new Set<string>();
    const rng = makeRng(99);
    for (let i = 0; i < 5000; i++) ids.add(makeUuid(rng));
    expect(ids.size).toBe(5000);

    const again = makeRng(99);
    const first = makeUuid(again);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect([...ids][0]).toBe(first);
  });

  it("throws rather than returning undefined when picking from nothing", () => {
    expect(() => makeRng(1).pick([])).toThrow();
  });
});
