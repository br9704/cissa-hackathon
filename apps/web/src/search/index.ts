/*
  The searchable corpus.

  Decisions and debrief answers together, because the answer to "why is the expiry window
  capped" is as likely to be something someone said in a debrief as something written in
  a decision record. Both carry enough context to stand alone as a citation.
*/
import { corpus, memberName, strategyName } from "../data/source";
import { embedMany, embed, cosine, EMBEDDING_MODEL } from "./embed";
import { report, done } from "../boot/assets";
import { buildLexicalIndex, bm25, normalise, termCoverage, type LexicalIndex } from "./lexical";

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
    vectorPromise = embedMany(half.documents, (d, t) => {
      /* Reports only if something registered it. The boot manifest deliberately does not:
         this model downloads when the palette first opens, which is usually long after the
         boot screen has gone. */
      report("search", t === 0 ? 0 : d / t);
      onProgress?.(d, t);
    })
      .then((v) => {
        done("search");
        return v;
      })
      .catch((err) => {
      /* Kept visible in the console: degrading silently is how you ship a worse product
         than you think you shipped. */
      console.warn("[search] embedding model unavailable, falling back to keyword search", err);
      /* A failed model must not hold the boot bar at 30 percent forever. */
      done("search");
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
  The lexical only floor, measured the same way the hybrid one was.

  The first version of this filtered the normalised BM25 score at 0.35, which was
  meaningless. `normalise` divides by the best score in this query's OWN result set, so the
  top document scores exactly 1.00 whenever any single term matches anything at all. It
  admitted forty passages for "how many people work here", every one of them labelled 1.00,
  while the comment above it claimed to be protecting the reader from precisely that.

  So degraded mode gates on term COVERAGE, which is absolute: what fraction of the
  question's content words actually appear in the passage. Measured over the seeded corpus,
  questions it can answer peak at 0.60 to 1.00 and questions it cannot peak at 0.00 to 0.50,
  so 0.60 sits in a real gap with clear air on both sides.

  This is a weaker guarantee than the hybrid floor, and that is the honest situation rather
  than a defect: without vectors there is no way to know that a passage means the same thing
  in different words, so a rephrased question can miss. The palette says so on screen.
*/
export const LEXICAL_COVERAGE_FLOOR = 0.6;

function lexicalOnly(
  items: Passage[],
  lexical: LexicalIndex,
  query: string,
  limit: number,
): Hit[] {
  const coverage = termCoverage(lexical, query);
  const ranked = normalise(bm25(lexical, query));
  return items
    .map((p, i) => ({
      ...p,
      semantic: 0,
      lexical: ranked.get(i) ?? 0,
      /*
        The reported score is coverage, not the normalised BM25 value, because the
        normalised value is relative: the top hit reads 1.00 however irrelevant it is, and a
        confident 1.00 beside a wrong answer is worse than showing no number at all.
      */
      similarity: coverage.get(i) ?? 0,
    }))
    .filter((h) => h.similarity >= LEXICAL_COVERAGE_FLOOR)
    .sort((a, b) => b.similarity - a.similarity || b.lexical - a.lexical)
    .slice(0, limit);
}

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

  if (!vectors) return { hits: lexicalOnly(items, lexical, query, limit), mode: "lexical" };

  /*
    The index can build successfully and a later single query embed still fail: a long lived
    tab can lose its WebGPU context or run the WASM heap out. That used to reject and put
    "Search is unavailable" back on screen, which is the exact dead end this file was
    restructured to remove. Falling through to keyword matching gives the same answer the
    no-vectors path gives, rather than no answer.
  */
  let q: Float32Array;
  try {
    q = await embed(query);
  } catch (err) {
    console.warn("[search] query embedding failed, answering from the keyword index", err);
    return { hits: lexicalOnly(items, lexical, query, limit), mode: "lexical" };
  }

  const lex = normalise(bm25(lexical, query));
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

/** Hybrid only, kept for the tests that assert the blended behaviour directly. */
export async function search(query: string, limit = 5, floor = RELEVANCE_FLOOR): Promise<Hit[]> {
  return (await searchDetailed(query, limit, floor)).hits;
}
