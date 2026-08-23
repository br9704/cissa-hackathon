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
