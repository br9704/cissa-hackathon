/*
  The searchable corpus.

  Decisions and debrief answers together, because the answer to "why is the expiry window
  capped" is as likely to be something someone said in a debrief as something written in
  a decision record. Both carry enough context to stand alone as a citation.
*/
import { corpus, memberName, strategyName } from "../data/source";
import { embedMany, embed, cosine, EMBEDDING_MODEL } from "./embed";
import { buildLexicalIndex, bm25, normalise, type LexicalIndex } from "./lexical";

export type Passage = {
  id: string;
  source: "decision" | "debrief";
  title: string;
  body: string;
  strategyId: string | null;
  authorName: string;
  /* Which model produced the vector. Retrieval filters on it, because two 384 dimension
     models are still two different vector spaces and comparing across them returns
     confident nonsense rather than an error. */
  embeddingModel: string;
};

export type Hit = Passage & {
  /* The blended score that decided the ranking. */
  similarity: number;
  /* Kept separately so the UI can be honest about WHY a passage was returned, and so a
     bad ranking can be diagnosed rather than guessed at. */
  semantic: number;
  lexical: number;
};

export function passages(): Passage[] {
  const c = corpus();
  const out: Passage[] = [];

  for (const d of c.decisions) {
    out.push({
      id: d.id,
      source: "decision",
      title: d.title,
      /* The reasoning and the rejected alternatives, because the alternatives are half
         of what makes a decision record worth keeping. */
      body: [d.why, ...d.alternatives.map((a) => `Rejected: ${a}`)].join(" "),
      strategyId: d.strategyId,
      authorName: memberName(d.authorMemberId),
      embeddingModel: EMBEDDING_MODEL,
    });
  }

  const sessionById = new Map(c.sessions.map((s) => [s.id, s]));
  for (const t of c.turns) {
    if (t.role !== "human") continue;
    const session = sessionById.get(t.sessionId);
    out.push({
      id: `${t.sessionId}:${t.seq}`,
      source: "debrief",
      title: `Debrief answer, ${strategyName(session?.strategyId ?? null)}`,
      body: t.text,
      strategyId: session?.strategyId ?? null,
      authorName: memberName(session?.memberId ?? null),
      embeddingModel: EMBEDDING_MODEL,
    });
  }

  return out;
}

let indexPromise: Promise<{
  passages: Passage[];
  vectors: Float32Array[];
  lexical: LexicalIndex;
}> | null = null;

/**
 * Build the index once per session.
 *
 * In the deployed demo this work happens once at seed time and lives in the pgvector
 * column; here it runs in the tab, which is slower to start and is the same arithmetic.
 */
export function buildIndex(onProgress?: (done: number, total: number) => void) {
  if (!indexPromise) {
    indexPromise = (async () => {
      const items = passages();
      /*
        The strategy name goes into the indexed text as well as the title. Somebody asking
        about "the India book" is asking about a strategy by name, and without it in the
        text neither half of retrieval can see the connection.
      */
      const documents = items.map(
        (p) => `${p.title}. ${strategyName(p.strategyId)}. ${p.body}`,
      );
      /* Lexical first: it is instant, so if the model fails to load there is still a
         working search rather than a broken one. */
      const lexical = buildLexicalIndex(documents);
      const vectors = await embedMany(documents, onProgress);
      return { passages: items, vectors, lexical };
    })();
  }
  return indexPromise;
}

/*
  How the two halves are weighted.

  Slightly toward the vectors, because most questions are asked in different words than
  the record was written in and that is precisely what the embedding is for. The lexical
  half is there to stop the model returning everything about the right subject and
  nothing that answers the question, so it needs enough weight to move the top result and
  not so much that an exact word match beats an actual answer.
*/
const SEMANTIC_WEIGHT = 0.62;
const LEXICAL_WEIGHT = 0.38;

/*
  The relevance floor, measured rather than chosen.

  Over the seeded corpus, questions the corpus can answer score 0.88 to 0.93 blended, and
  questions it cannot (the capital of France, how to bake bread) top out at 0.47. 0.60
  sits in the gap with a wide margin on both sides.

  The reason the gap is that clean is the lexical half. gte-small returns a cosine of
  about 0.75 for a question with nothing whatsoever to do with the corpus, so a semantic
  only threshold has to be set inside the noise and will always be either too strict for
  a rephrased question or too loose for an unrelated one. BM25 returns exactly zero when
  no query term appears anywhere, and that zero is what makes the two populations
  separable at all.

  retrieval.test.ts holds this number honest against the real model.
*/
export const RELEVANCE_FLOOR = 0.6;

/**
 * Retrieve, hybrid.
 *
 * A floor rather than a fixed top k. If nothing in the corpus is close to the question,
 * the honest answer is that it is not in the corpus, and returning the five least bad
 * passages would dress that up as an answer. No source, no claim.
 */
export async function search(query: string, limit = 5, floor = RELEVANCE_FLOOR): Promise<Hit[]> {
  const { passages: items, vectors, lexical } = await buildIndex();
  const q = await embed(query);
  const lex = normalise(bm25(lexical, query));

  return items
    .map((p, i) => {
      const semantic = cosine(q, vectors[i]!);
      const lexicalScore = lex.get(i) ?? 0;
      return {
        ...p,
        semantic,
        lexical: lexicalScore,
        similarity: SEMANTIC_WEIGHT * semantic + LEXICAL_WEIGHT * lexicalScore,
      };
    })
    .filter((h) => h.similarity >= floor)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
