import { describe, it, expect } from "vitest";
import { generate, DEFAULT_SEED } from "./generate";
import { DECISION_TYPES } from "./vocabulary";

/*
  These are the assertions the demo depends on. If any of them stops holding, the risk
  board has nothing to show and the video's money shot is a flat line.
*/
describe("synthetic corpus", () => {
  const corpus = generate(DEFAULT_SEED);

  it("reproduces exactly from the same seed", () => {
    const again = generate(DEFAULT_SEED);
    expect(JSON.stringify(again)).toBe(JSON.stringify(corpus));
  });

  it("differs from a different seed", () => {
    expect(generate(1).firmId).not.toBe(corpus.firmId);
  });

  it("has the cast, the books and enough history to be worth reading", () => {
    expect(corpus.members).toHaveLength(5);
    expect(corpus.strategies).toHaveLength(4);
    expect(corpus.decisions.length).toBeGreaterThan(150);
    expect(corpus.artifacts.length).toBeGreaterThan(150);
    expect(corpus.links.length).toBeGreaterThan(50);
  });

  it("ships four speaker tagged meeting transcripts that decisions cite", () => {
    const transcripts = corpus.artifacts.filter((a) => a.kind === "meeting_transcript");
    expect(transcripts).toHaveLength(4);
    const transcriptIds = new Set(transcripts.map((t) => t.id));
    const citing = corpus.decisions.filter((d) =>
      d.sourceArtifactIds.some((id) => transcriptIds.has(id)),
    );
    expect(citing.length).toBeGreaterThan(5);
  });

  it("concentrates knowledge in Daniel, because that is the whole demo", () => {
    const daniel = corpus.members.find((m) => m.key === "daniel")!;
    const india = corpus.strategies.find((s) => s.key === "india_carry")!;
    const onIndia = corpus.decisions.filter((d) => d.strategyId === india.id);
    const his = onIndia.filter((d) => d.authorMemberId === daniel.id);
    /* If this ever drops below a clear majority the departure simulation stops landing. */
    expect(his.length / onIndia.length).toBeGreaterThan(0.55);
  });

  it("covers every label class, so the tagger has something to learn from each", () => {
    const seen = new Set(corpus.labelled.map((l) => l.label));
    for (const type of DECISION_TYPES) expect(seen.has(type)).toBe(true);
  });

  it("emits enough labelled rows to train on, without padding by duplication", () => {
    expect(corpus.labelled.length).toBeGreaterThanOrEqual(2200);
    const unique = new Set(corpus.labelled.map((l) => l.text));
    /* Duplicates would inflate the count and teach the model nothing new, so most rows
       have to be genuinely distinct text. */
    expect(unique.size / corpus.labelled.length).toBeGreaterThan(0.9);
  });

  it("has both risk flagged and unflagged rows in useful proportion", () => {
    const flagged = corpus.labelled.filter((l) => l.risk).length;
    const ratio = flagged / corpus.labelled.length;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.6);
  });

  it("leaves a few decisions unapproved so the draft queue is not empty on load", () => {
    const drafts = corpus.decisions.filter((d) => d.approvedAt === null);
    expect(drafts.length).toBeGreaterThan(0);
    for (const d of drafts) expect(d.draftedBy).toBe("model");
  });

  it("grounds every agent debrief question in something the person actually did", () => {
    const exit = corpus.sessions.find((s) => s.triggerReason === "exit")!;
    const agentTurns = corpus.turns.filter((t) => t.sessionId === exit.id && t.role === "agent");
    expect(agentTurns.length).toBeGreaterThan(3);
    expect(agentTurns.every((t) => t.groundedArtifactIds.length > 0)).toBe(true);
  });

  it("ranks unanswered questions above answered ones", () => {
    const answered = corpus.questions.filter((q) => q.answeredByDecisionId);
    const open = corpus.questions.filter((q) => !q.answeredByDecisionId);
    expect(open.length).toBeGreaterThan(0);
    const worstAnswered = Math.max(...answered.map((q) => q.undocumentedness));
    const bestOpen = Math.min(...open.map((q) => q.undocumentedness));
    expect(bestOpen).toBeGreaterThan(worstAnswered);
  });

  it("never links a decision to itself", () => {
    for (const l of corpus.links) expect(l.parent).not.toBe(l.child);
  });
});
