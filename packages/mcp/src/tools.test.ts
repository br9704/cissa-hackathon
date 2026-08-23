import { describe, it, expect } from "vitest";
import { generate } from "@continuity/core";
import { searchLedger, getDecision, recordDecision } from "./tools";

const corpus = generate();

describe("search_ledger", () => {
  it("finds records the ledger actually holds", () => {
    const out = searchLedger(corpus, { query: "expiry window capped" });
    expect(out).toMatch(/Why:/);
  });

  it("declines rather than returning the nearest few", () => {
    /* The same property the app's retrieval has: no source, no claim. */
    const out = searchLedger(corpus, { query: "what is the capital of france" });
    expect(out).toMatch(/Nothing in the ledger/i);
  });
});

describe("get_decision", () => {
  it("says so plainly when the id is not in the record", () => {
    expect(getDecision(corpus, { id: "nope" })).toMatch(/No decision with id/);
  });

  it("returns the reasoning, not just the title", () => {
    const d = corpus.decisions[0]!;
    const out = getDecision(corpus, { id: d.id });
    expect(out).toContain(d.why);
  });
});

describe("record_decision", () => {
  it("refuses to file a record with no reasoning", () => {
    /* The one field the product exists for. Filing without it would make the ledger a log. */
    const out = recordDecision(corpus, { title: "Changed a thing" });
    expect(out).toMatch(/needs both a title and the reasoning/i);
    expect(out).toMatch(/ask them/i);
  });
});
