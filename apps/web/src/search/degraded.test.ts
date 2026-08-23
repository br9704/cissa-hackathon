/*
  Search must degrade, not die.

  When the embedding model cannot be fetched (blocked CDN, offline, conference wifi) the
  palette used to render "Search is unavailable: Failed to fetch" while a complete BM25
  index sat unused. Worse, the rejection was cached, so every later query failed too.

  Module state is per-import here, so each case resets the registry and re-imports to get a
  clean index.
*/
import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("./embed");
});

describe("when the embedding model cannot load", () => {
  it("still answers from the keyword index, and says which mode it used", async () => {
    vi.doMock("./embed", async () => {
      const actual = await vi.importActual<typeof import("./embed")>("./embed");
      return {
        ...actual,
        embedMany: vi.fn().mockRejectedValue(new Error("Failed to fetch")),
        embed: vi.fn().mockRejectedValue(new Error("Failed to fetch")),
      };
    });
    const { searchDetailed } = await import("./index");

    const { hits, mode } = await searchDetailed("expiry window");
    expect(mode).toBe("lexical");
    expect(hits.length).toBeGreaterThan(0);
    /* Never silently blended: a degraded hit carries no semantic component. */
    expect(hits.every((h) => h.semantic === 0)).toBe(true);
  });

  it("does not cache the failure into every later query", async () => {
    vi.doMock("./embed", async () => {
      const actual = await vi.importActual<typeof import("./embed")>("./embed");
      return { ...actual, embedMany: vi.fn().mockRejectedValue(new Error("nope")) };
    });
    const { searchDetailed } = await import("./index");

    await searchDetailed("expiry window");
    const second = await searchDetailed("India carry");
    expect(second.mode).toBe("lexical");
    expect(second.hits.length).toBeGreaterThan(0);
  });

  /*
    The case that exposed the first version as meaningless.

    The original gate filtered the NORMALISED bm25 score at 0.35. normalise divides by the
    best score in the query's own result set, so the top document always reads 1.00 and the
    gate rejected almost nothing: this query returned forty passages, led by a decision about
    lowering realised_lookback, each labelled 1.00 relevance.
  */
  it.each([
    "how many people work here",
    "should we hire more people",
    "what did John say about pizza",
    "what should I have for lunch on the desk",
    "is the market open",
  ])("refuses off topic question: %s", async (query) => {
    vi.doMock("./embed", async () => {
      const actual = await vi.importActual<typeof import("./embed")>("./embed");
      return { ...actual, embedMany: vi.fn().mockRejectedValue(new Error("nope")) };
    });
    const { searchDetailed } = await import("./index");
    const { hits, mode } = await searchDetailed(query);
    expect(mode).toBe("lexical");
    expect(hits).toHaveLength(0);
  });

  it("still answers a question the corpus does cover", async () => {
    vi.doMock("./embed", async () => {
      const actual = await vi.importActual<typeof import("./embed")>("./embed");
      return { ...actual, embedMany: vi.fn().mockRejectedValue(new Error("nope")) };
    });
    const { searchDetailed } = await import("./index");
    const { hits } = await searchDetailed("why is the expiry window capped");
    expect(hits.length).toBeGreaterThan(0);
    /* The reported score is absolute coverage, so it is meaningful rather than always 1.00. */
    expect(hits[0]!.similarity).toBeGreaterThanOrEqual(0.6);
    expect(hits[0]!.similarity).toBeLessThanOrEqual(1);
  });

  it("falls back to keywords when the index built but the query embed fails", async () => {
    vi.doMock("./embed", async () => {
      const actual = await vi.importActual<typeof import("./embed")>("./embed");
      return {
        ...actual,
        embedMany: vi.fn().mockResolvedValue([new Float32Array([1, 0, 0])]),
        embed: vi.fn().mockRejectedValue(new Error("context lost")),
      };
    });
    const { searchDetailed } = await import("./index");
    /* Must not reject. Rejecting is what put "Search is unavailable" back on screen. */
    const { mode } = await searchDetailed("why is the expiry window capped");
    expect(mode).toBe("lexical");
  });

  it("still refuses a question the corpus cannot answer", async () => {
    vi.doMock("./embed", async () => {
      const actual = await vi.importActual<typeof import("./embed")>("./embed");
      return { ...actual, embedMany: vi.fn().mockRejectedValue(new Error("nope")) };
    });
    const { searchDetailed } = await import("./index");

    /*
      The property that must survive degradation: BM25 scores exactly zero when no query
      term appears anywhere, so "not in the record" stays a real answer rather than the
      five least bad passages.
    */
    const { hits } = await searchDetailed("what is the capital of France");
    expect(hits).toHaveLength(0);
  });
});
