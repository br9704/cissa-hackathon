/*
  Answering in a departed colleague's voice.

  The obvious way to build this is to hand a language model the retrieved passages and
  ask it to write in Daniel's voice. That is worse than what is here, for two reasons
  that matter more than the polish it would buy.

  It would be a fabrication. A generated sentence in a named person's voice is a thing
  they never said, presented as a thing they said, in a product whose entire argument is
  that the record is trustworthy. On a compliance surface that is not a small problem.

  And it would be weaker. What lands is not fluency, it is recognition: these are the
  words he actually typed, at a timestamp, in a record you can open. Generation would
  smooth exactly that away.

  So this is extractive. Every sentence in an answer is a sentence somebody wrote, quoted
  and cited, and the assembly is the only thing this module does. If a language model is
  wired in later, its job is to order and connect quotations, never to author them.
*/
import { search, type Hit } from "./index";
import { corpus } from "../data/source";

export type RecalledLine = {
  text: string;
  passageId: string;
  source: "decision" | "debrief";
  title: string;
  strategyName: string;
  /* How close the retrieved passage was to the question. Shown, not hidden. */
  confidence: number;
};

export type Recall = {
  memberId: string;
  memberName: string;
  question: string;
  lines: RecalledLine[];
  /* True when the corpus holds nothing this person wrote about the question. That is a
     real answer and it is displayed as one. */
  silent: boolean;
};

/**
 * Split into sentences without a tokeniser.
 *
 * Naive splitting on periods breaks 0.65 into two sentences, which in this corpus is
 * most of the interesting text. So a period only ends a sentence when it is followed by
 * whitespace and something that starts a new sentence.
 */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

/**
 * Ask a departed colleague a question.
 *
 * Retrieval is over the whole corpus and then filtered to this person's authorship,
 * rather than retrieving only over their passages. That ordering matters: it means the
 * relevance floor is judged against everything the firm knows, so an answer is not
 * promoted just because it was the best thing this one person happened to write.
 */
export async function recall(memberId: string, question: string): Promise<Recall> {
  const c = corpus();
  const member = c.members.find((m) => m.id === memberId);
  const name = member?.displayName ?? "Unknown";

  const hits = await search(question, 12);
  const theirs = hits.filter((h) => h.authorName === name);

  const lines: RecalledLine[] = [];
  const seen = new Set<string>();

  for (const hit of theirs) {
    for (const sentence of pickSentences(hit, question)) {
      /*
        Near duplicate rather than exact duplicate.

        The same reasoning gets written up more than once on the same ground, differing
        only in a date or a threshold: "two days after the 20 March flag" and "two days
        after the 18 March flag" are the same sentence to a reader and different strings
        to a Set. An answer that says the same thing twice with one number changed reads
        as a bug, so the dedupe key drops numbers and month names and compares what is
        left.
      */
      const key = fingerprint(sentence);
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({
        text: sentence,
        passageId: hit.id,
        source: hit.source,
        title: hit.title,
        strategyName: hit.strategyId
          ? (c.strategies.find((s) => s.id === hit.strategyId)?.name ?? "Unassigned")
          : "Unassigned",
        confidence: hit.similarity,
      });
      if (lines.length >= 4) break;
    }
    if (lines.length >= 4) break;
  }

  return { memberId, memberName: name, question, lines, silent: lines.length === 0 };
}

/**
 * A comparison key that ignores the parts that vary between retellings.
 *
 * Numbers and dates are exactly what changes when the same decision is written up twice,
 * and they are also what makes two otherwise identical sentences look distinct to a Set.
 */
export function fingerprint(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
      "",
    )
    .replace(/[0-9]+(\.[0-9]+)?/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The sentences from one passage worth quoting.
 *
 * Ranked by overlap with the question rather than by position, because the first
 * sentence of a decision record is usually the restatement and the answer is the one
 * after it.
 */
function pickSentences(hit: Hit, question: string): string[] {
  const terms = new Set(
    question
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((t) => t.length > 3),
  );

  return sentences(hit.body)
    .map((s) => {
      const words = s.toLowerCase().split(/[^a-z0-9_]+/);
      const overlap = words.filter((w) => terms.has(w)).length;
      return { s, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2)
    .map((x) => x.s);
}
