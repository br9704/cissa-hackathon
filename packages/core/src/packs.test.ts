import { describe, it, expect } from "vitest";
import { generate, DEFAULT_SEED } from "./seed/generate";
import { scoreStrategy } from "./scoring";
import { handoverPack, rts6ChangeLog, sr117Documentation } from "./packs";

/*
  The generated documents are the artifact a compliance officer actually holds, so the
  assertions here are about what must be true of a document rather than about formatting.
*/
const c = generate(DEFAULT_SEED);
const memberName = (id: string | null) =>
  c.members.find((m) => m.id === id)?.displayName ?? "Unattributed";
const authors = new Map(c.decisions.map((d) => [d.id, d.authorMemberId]));
const scores = new Map(
  c.strategies.map((s) => [
    s.id,
    scoreStrategy({
      strategyId: s.id,
      items: c.decisions
        .filter((d) => d.strategyId === s.id)
        .map((d) => ({ strategyId: s.id, authorMemberId: d.authorMemberId, weight: d.riskFlag ? 2 : 1 })),
      openQuestions: c.questions.filter((q) => q.strategyId === s.id),
      decisionAuthors: authors,
    }),
  ]),
);
const daniel = c.members.find((m) => m.displayName.startsWith("Daniel"))!;
const GENERATED_AT = "2026-08-21T09:00:00.000Z";

const pack = handoverPack({
  firmName: c.firmName,
  member: daniel,
  strategies: c.strategies,
  decisions: c.decisions,
  questions: c.questions,
  sessions: c.sessions,
  turns: c.turns,
  scores,
  throughEvent: 184,
  generatedAt: GENERATED_AT,
});

describe("handover pack", () => {
  it("is deterministic, which is what makes a pack hash mean anything", () => {
    const again = handoverPack({
      firmName: c.firmName, member: daniel, strategies: c.strategies,
      decisions: c.decisions, questions: c.questions, sessions: c.sessions,
      turns: c.turns, scores, throughEvent: 184, generatedAt: GENERATED_AT,
    });
    expect(again).toBe(pack);
  });

  it("says DRAFT and names the ledger position it came from", () => {
    /* A generated artifact that cannot be reconciled with the ledger is a document, not
       evidence. */
    expect(pack).toContain("**DRAFT.**");
    expect(pack).toContain("event 184");
  });

  it("leads with judgement rather than with a table of positions", () => {
    /* SYSC 25.9 asks for judgement and opinion, not just facts and figures, and the
       ordering is how that shows up in a generated document. */
    const inherit = pack.indexOf("What you are inheriting");
    const questions = pack.indexOf("Questions nobody else can currently answer");
    const reasoning = pack.indexOf("their own words");
    const index = pack.indexOf("Full decision index");
    expect(inherit).toBeLessThan(questions);
    expect(questions).toBeLessThan(reasoning);
    expect(reasoning).toBeLessThan(index);
  });

  it("names the books nobody else can cover", () => {
    expect(pack).toContain("bus factor of one");
    expect(pack).toMatch(/India options carry|Expiry window effects/);
  });

  it("quotes the person rather than describing them", () => {
    expect(pack).toContain("> ");
  });

  it("carries every decision they recorded", () => {
    const theirs = c.decisions.filter((d) => d.authorMemberId === daniel.id);
    expect(pack).toContain(`${theirs.length} decisions recorded`);
  });

  it("has no em dashes", () => {
    /* House rule, and it applies to generated output as much as to prose someone typed. */
    expect(pack).not.toContain("—");
  });
});

describe("RTS 6 change log", () => {
  const strategy = c.strategies.find((s) => s.key === "india_carry")!;
  const log = rts6ChangeLog({
    firmName: c.firmName, strategy,
    decisions: c.decisions, memberName, throughEvent: 184, generatedAt: GENERATED_AT,
  });

  it("carries the four columns the regulation names", () => {
    /* When, who made it, who approved it, nature of the change. */
    expect(log).toContain("| When | Nature of change | Made by | Approved | Risk |");
  });

  it("includes unapproved model drafts rather than hiding them", () => {
    /* Omitting them would misrepresent the record, which is worse than showing that some
       rows are still drafts. */
    expect(log).toContain("not yet approved");
  });

  it("covers every decision on the strategy", () => {
    const n = c.decisions.filter((d) => d.strategyId === strategy.id).length;
    expect(log).toContain(`${n} material changes recorded`);
  });
});

describe("SR 11-7 documentation", () => {
  const strategy = c.strategies.find((s) => s.key === "india_carry")!;
  const doc = sr117Documentation({
    firmName: c.firmName, strategy,
    decisions: c.decisions, questions: c.questions,
    score: scores.get(strategy.id), memberName,
    throughEvent: 184, generatedAt: GENERATED_AT,
  });

  it("starts with what the strategy does, before what changed", () => {
    /* The binding constraint is that a stranger can read it. */
    expect(doc.indexOf("What it does")).toBeLessThan(doc.indexOf("What has changed"));
  });

  it("states the bus factor as a documentation finding, not a performance one", () => {
    expect(doc).toContain("documentation finding, not a performance one");
  });

  it("lists its own gaps", () => {
    expect(doc).toContain("Known gaps");
  });
});
