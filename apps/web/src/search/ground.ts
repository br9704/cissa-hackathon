/*
  Grounding a generated answer against the record.

  The rule this enforces is the one the whole product rests on: the model is never allowed to
  outrank the ledger. A generated sentence that the record cannot support is shown struck
  through and labelled, rather than quietly deleted or quietly kept. Deleting it would hide
  that the model said it; keeping it unmarked would let a fluent invention pass as a record.

  Sentence level rather than whole answer, because a good answer with one invented clause is
  the dangerous case. An answer that is entirely wrong is obvious; an answer that is ninety
  percent right is the one somebody acts on.

  The check is deliberately the same coverage measure the lexical fallback uses, for the same
  reason: it is absolute, it is explainable to somebody who asks how it decided, and it
  returns exactly zero when nothing overlaps.
*/
import { termCoverage, buildLexicalIndex } from "./lexical";

export type GroundedClaim = {
  text: string;
  grounded: boolean;
  /* The best supporting passage, when there is one. */
  support: string | null;
  coverage: number;
};

/* Chosen to match LEXICAL_COVERAGE_FLOOR, and for the same measured reason: over the seeded
   corpus, supported statements sit at or above 0.6 and unsupported ones peak at 0.5. */
export const GROUNDING_FLOOR = 0.6;

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

/**
 * Check every sentence of a generated answer against the passages retrieved for the question.
 *
 * A citation the model wrote inside its own text is not evidence. This is what turns it into
 * evidence, or marks it as unsupported.
 */
export function groundAnswer(answer: string, passages: string[]): GroundedClaim[] {
  if (passages.length === 0) {
    return splitSentences(answer).map((text) => ({
      text,
      grounded: false,
      support: null,
      coverage: 0,
    }));
  }

  const index = buildLexicalIndex(passages);

  return splitSentences(answer).map((sentence) => {
    const coverage = termCoverage(index, sentence);
    let best = -1;
    let bestScore = 0;
    for (const [doc, score] of coverage) {
      if (score > bestScore) {
        bestScore = score;
        best = doc;
      }
    }
    return {
      text: sentence,
      grounded: bestScore >= GROUNDING_FLOOR,
      support: best >= 0 && bestScore >= GROUNDING_FLOOR ? passages[best]! : null,
      coverage: Number(bestScore.toFixed(3)),
    };
  });
}
