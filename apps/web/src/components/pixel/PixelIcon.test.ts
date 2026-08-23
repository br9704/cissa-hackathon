/*
  A malformed glyph does not throw, it renders as a smear, and a smear is the kind of defect
  that survives until somebody looks at a screenshot. So the grids are checked here instead.
*/
import { describe, it, expect } from "vitest";
import { GLYPH_NAMES, glyphGrid, pixelRuns } from "./PixelIcon";

describe("glyph grids", () => {
  it.each(GLYPH_NAMES)("%s is exactly twelve rows of twelve characters", (name) => {
    const grid = glyphGrid(name);
    expect(grid).toHaveLength(12);
    for (const row of grid) expect(row).toHaveLength(12);
  });

  it.each(GLYPH_NAMES)("%s draws something", (name) => {
    expect(pixelRuns(name).length).toBeGreaterThan(0);
  });
});

describe("run merging", () => {
  it("merges consecutive filled cells into one rect per run", () => {
    /* record's first row is ".##########." : one run of ten starting at x=1. */
    const first = pixelRuns("record")[0]!;
    expect(first).toEqual({ x: 1, y: 0, w: 10 });
  });

  it("never emits a run that leaves the grid", () => {
    for (const name of GLYPH_NAMES) {
      for (const r of pixelRuns(name)) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(12);
      }
    }
  });

  it("emits fewer rects than filled cells, which is the point of merging", () => {
    const filled = glyphGrid("record").join("").split("").filter((c) => c === "#").length;
    expect(pixelRuns("record").length).toBeLessThan(filled);
  });
});
