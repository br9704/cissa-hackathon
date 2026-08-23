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

/*
  The index is deliberately in two halves, and they fail independently.

  The previous version built both inside one cached promise and the comment claimed that
  lexical would still work if the model failed to load. It would not: `embedMany` was
  awaited inside that same promise, so a blocked CDN rejected the whole thing, and because
  the rejected promise stayed cached, every later search failed too. On conference wifi
  that turned the hero feature into a dead end reading "Failed to fetch" while a complete
  BM25 index sat unused three lines above.

  So: lexical is synchronous and cannot fail, vectors are optional, and search degrades to
  keyword matching rather than dying.
*/
type LexicalHalf = { passages: Passage[]; documents: string[]; lexical: LexicalIndex };

let lexicalHalf: LexicalHalf | null = null;
let vectorPromise: Promise<Float32Array[] | null> | null = null;

function buildLexicalHalf(): LexicalHalf {
  if (!lexicalHalf) {
    const items = passages();
    /*
      The strategy name goes into the indexed text as well as the title. Somebody asking
      about "the India book" is asking about a strategy by name, and without it in the
      text neither half of retrieval can see the connection.
    */
    const documents = items.map(
      (p) => `${p.title}. ${strategyName(p.strategyId)}. ${p.body}`,
    );
    lexicalHalf = { passages: items, documents, lexical: buildLexicalIndex(documents) };
  }
  return lexicalHalf;
}

/**
 * Build the index once per session.
 *
 * In the deployed demo this work happens once at seed time and lives in the pgvector
 * column; here it runs in the tab, which is slower to start and is the same arithmetic.
 *
 * Resolves to null for the vector half when the model cannot load. That is a degraded
 * search, not an error, so it is reported rather than thrown.
 */
export function buildIndex(onProgress?: (done: number, total: number) => void) {
  const half = buildLexicalHalf();
  if (!vectorPromise) {
    vectorPromise = embedMany(half.documents, onProgress).catch((err) => {
      /* Kept visible in the console: degrading silently is how you ship a worse product
         than you think you shipped. */
      console.warn("[search] embedding model unavailable, falling back to keyword search", err);
      return null;
    });
  }
  return vectorPromise.then((vectors) => ({ ...half, vectors }));
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
export type SearchMode = "hybrid" | "lexical";
export type SearchResult = { hits: Hit[]; mode: SearchMode };

/*
  The lexical only floor, and why it is a different number.

  In hybrid mode a passage scores SEMANTIC_WEIGHT * semantic + LEXICAL_WEIGHT * lexical, so
  a perfect keyword match alone tops out at 0.38 and every result would fall under the 0.60
  blended floor. Degraded mode therefore scores on the normalised BM25 value directly.

  Unlike RELEVANCE_FLOOR this number is CHOSEN, not measured, and the UI says so. What it
  keeps is the property that matters: BM25 returns exactly zero when no query term appears
  anywhere, so "not in the corpus" still returns nothing rather than the five least bad
  passages dressed up as an answer.
*/
export const LEXICAL_FLOOR = 0.35;

/**
 * Retrieve, hybrid when the model is available and keyword only when it is not.
 *
 * A floor rather than a fixed top k. If nothing in the corpus is close to the question,
 * the honest answer is that it is not in the corpus, and returning the five least bad
 * passages would dress that up as an answer. No source, no claim.
 */
export async function searchDetailed(
  query: string,
  limit = 5,
  floor = RELEVANCE_FLOOR,
): Promise<SearchResult> {
  const { passages: items, vectors, lexical } = await buildIndex();
  const lex = normalise(bm25(lexical, query));

  if (!vectors) {
    const hits = items
      .map((p, i) => {
        const lexicalScore = lex.get(i) ?? 0;
        return { ...p, semantic: 0, lexical: lexicalScore, similarity: lexicalScore };
      })
      .filter((h) => h.similarity >= LEXICAL_FLOOR)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    return { hits, mode: "lexical" };
  }

  const q = await embed(query);
  const hits = items
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
  return { hits, mode: "hybrid" };
}

/** The shape every existing caller and test expects. */
export async function search(query: string, limit = 5, floor = RELEVANCE_FLOOR): Promise<Hit[]> {
  return (await searchDetailed(query, limit, floor)).hits;
}
