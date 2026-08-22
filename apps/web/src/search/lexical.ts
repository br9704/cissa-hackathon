/*
  The lexical half of retrieval.

  Dense embeddings are good at meaning and bad at exactness. Ask "why is the expiry
  window capped" of a small embedding model and it happily returns anything about the
  expiry book, because those passages are about the same subject even when they answer a
  different question. The passage that literally says "Capped position size in the expiry
  window" ranks below them, which is the wrong way round for the one question the demo
  asks out loud.

  So retrieval is hybrid. BM25 over the same passages supplies the exactness the vectors
  lack, and the two scores are combined. This is the standard fix and it is worth the
  eighty lines: it is the difference between a search box that returns related reading
  and one that returns the answer.

  BM25 rather than raw term overlap because overlap rewards long passages and common
  words, and BM25 is the correction for exactly those two problems: saturating term
  frequency so a word repeated ten times is not ten times the evidence, and length
  normalisation so a wordy decision record does not outrank a precise one.
*/

const K1 = 1.4;
const B = 0.72;

/* Words that carry no signal in this corpus. Kept short on purpose: an aggressive stop
   list throws away "not" and "no", which in a record of rejected alternatives are the
   most load bearing words in the sentence. */
const STOP = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "it", "that",
  "this", "we", "our", "was", "were", "be", "been", "as", "at", "by", "with", "from",
  "why", "what", "how", "does", "do", "did", "so", "if", "then", "than",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    /* Keep underscores: vol_filter and expiry_cap are single terms on this desk, and
       splitting them turns a precise query into a vague one. */
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export type LexicalIndex = {
  /* term -> document index -> term frequency */
  postings: Map<string, Map<number, number>>;
  lengths: number[];
  avgLength: number;
  docCount: number;
};

export function buildLexicalIndex(documents: string[]): LexicalIndex {
  const postings = new Map<string, Map<number, number>>();
  const lengths: number[] = [];

  documents.forEach((doc, i) => {
    const terms = tokenize(doc);
    lengths.push(terms.length);
    for (const term of terms) {
      let byDoc = postings.get(term);
      if (!byDoc) {
        byDoc = new Map();
        postings.set(term, byDoc);
      }
      byDoc.set(i, (byDoc.get(i) ?? 0) + 1);
    }
  });

  const total = lengths.reduce((a, b) => a + b, 0);
  return {
    postings,
    lengths,
    avgLength: documents.length ? total / documents.length : 0,
    docCount: documents.length,
  };
}

/**
 * BM25 scores for one query, as a sparse map of document index to score.
 *
 * Only documents containing at least one query term are scored, which is the whole point
 * of an inverted index and keeps this linear in matches rather than in corpus size.
 */
export function bm25(index: LexicalIndex, query: string): Map<number, number> {
  const scores = new Map<number, number>();
  const terms = tokenize(query);
  if (terms.length === 0 || index.docCount === 0) return scores;

  for (const term of terms) {
    const byDoc = index.postings.get(term);
    if (!byDoc) continue;

    /*
      Robertson-Sparck Jones idf with the +1 that keeps it non negative. Without it a
      term appearing in more than half the corpus scores negatively and actively pushes
      down documents that contain it, which is defensible in theory and surprising in a
      product.
    */
    const df = byDoc.size;
    const idf = Math.log(1 + (index.docCount - df + 0.5) / (df + 0.5));

    for (const [doc, tf] of byDoc) {
      const len = index.lengths[doc] ?? 0;
      const norm = K1 * (1 - B + (B * len) / (index.avgLength || 1));
      const contribution = idf * ((tf * (K1 + 1)) / (tf + norm));
      scores.set(doc, (scores.get(doc) ?? 0) + contribution);
    }
  }

  return scores;
}

/**
 * Squash BM25 into 0 to 1 so it can be blended with a cosine similarity.
 *
 * Relative to the best score in this result set rather than to an absolute ceiling,
 * because BM25 has no upper bound and its scale moves with the query length.
 */
export function normalise(scores: Map<number, number>): Map<number, number> {
  let max = 0;
  for (const v of scores.values()) if (v > max) max = v;
  if (max === 0) return scores;
  const out = new Map<number, number>();
  for (const [k, v] of scores) out.set(k, v / max);
  return out;
}
