import { describe, it, expect } from "vitest";
import { generate } from "@continuity/core";
import { buildCurriculum, orderLessons } from "./curriculum";

const corpus = generate();

describe("orderLessons", () => {
  it("never places a decision before the one it replaced", () => {
    const decisions = corpus.decisions.filter((d) => d.strategyId === corpus.strategies[0]!.id);
    const ordered = orderLessons(decisions, corpus.links);
    const position = new Map(ordered.map((d, i) => [d.id, i]));
    const ids = new Set(decisions.map((d) => d.id));
    for (const link of corpus.links) {
      if (!ids.has(link.parent) || !ids.has(link.child)) continue;
      expect(position.get(link.parent)!).toBeLessThan(position.get(link.child)!);
    }
  });

  it("loses nothing even if the links contain a cycle", () => {
    /* A naive walk hangs here. Dropping the lesson would be worse than an imperfect order. */
    const decisions = corpus.decisions.slice(0, 5);
    const cyclic = [
      { parent: decisions[0]!.id, child: decisions[1]!.id },
      { parent: decisions[1]!.id, child: decisions[0]!.id },
    ];
    const ordered = orderLessons(decisions, cyclic);
    expect(ordered).toHaveLength(decisions.length);
    expect(new Set(ordered.map((d) => d.id)).size).toBe(decisions.length);
  });
});

describe("buildCurriculum", () => {
  const modules = buildCurriculum(corpus);

  it("builds one module per book", () => {
    expect(modules).toHaveLength(corpus.strategies.length);
  });

  it("teaches the thinnest record first", () => {
    const coverages = modules.map((m) => m.coverage);
    expect([...coverages].sort((a, b) => a - b)).toEqual(coverages);
  });

  it("derives every lesson from a real decision", () => {
    const ids = new Set(corpus.decisions.map((d) => d.id));
    for (const m of modules) {
      for (const l of m.lessons) expect(ids.has(l.decisionId)).toBe(true);
    }
  });

  it("keeps coverage a bounded property of the record", () => {
    for (const m of modules) {
      expect(m.coverage).toBeGreaterThanOrEqual(0);
      expect(m.coverage).toBeLessThanOrEqual(1);
      expect(m.gaps).toBeLessThanOrEqual(m.lessons.length);
    }
  });

  it("uses only unanswered questions as the syllabus", () => {
    const answered = new Set(
      corpus.questions.filter((q) => q.answeredByDecisionId).map((q) => q.id),
    );
    for (const m of modules) {
      for (const q of m.openQuestions) expect(answered.has(q.id)).toBe(false);
    }
  });
});
