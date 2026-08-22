import { describe, it, expect, beforeAll } from "vitest";
import { pipeline, env } from "@huggingface/transformers";
import { generate } from "@continuity/core";
import { buildLexicalIndex, bm25, normalise, type LexicalIndex } from "./lexical";
import { RELEVANCE_FLOOR } from "./index";

/*
  Retrieval quality, against the real model.

  Slow, because it downloads a 32 MB model on a cold cache and embeds the whole corpus.
  It is worth the wall clock: the ask bar is the feature that is demonstrated out loud,
  and its two failure modes are both silent. Returning related reading instead of the
  answer looks like a working search. Returning the five least bad passages for a
  question the corpus cannot answer looks like an answer, and under the honest claims
  rule that is the worse of the two.

  Runs in Node rather than a browser: same library, same weights, same arithmetic.
*/

const SEMANTIC_WEIGHT = 0.62;
const LEXICAL_WEIGHT = 0.38;

type Doc = { text: string; title: string };
let docs: Doc[] = [];
let vectors: Float32Array[] = [];
let lexical: LexicalIndex;
let embed: (t: string) => Promise<Float32Array>;

beforeAll(async () => {
  env.allowLocalModels = false;
  const c = generate();
  const strategyName = (id: string | null) =>
    c.strategies.find((s) => s.id === id)?.name ?? "Unassigned";

  docs = c.decisions.map((d) => ({
    title: d.title,
    text: `${d.title}. ${strategyName(d.strategyId)}. ${[d.why, ...d.alternatives].join(" ")}`,
  }));
  const sessions = new Map(c.sessions.map((s) => [s.id, s]));
  for (const t of c.turns) {
    if (t.role !== "human") continue;
    const strategy = strategyName(sessions.get(t.sessionId)?.strategyId ?? null);
    docs.push({ title: "Debrief answer", text: `Debrief answer. ${strategy}. ${t.text}` });
  }

  lexical = buildLexicalIndex(docs.map((d) => d.text));

  const pipe = (await pipeline("feature-extraction", "Supabase/gte-small", {
    dtype: "q8",
  })) as unknown as (t: string, o: object) => Promise<{ data: Float32Array }>;
  embed = async (t: string) =>
    new Float32Array((await pipe(t, { pooling: "mean", normalize: true })).data);

  for (const d of docs) vectors.push(await embed(d.text));
}, 300_000);

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

async function rank(query: string) {
  const q = await embed(query);
  const lex = normalise(bm25(lexical, query));
  return docs
    .map((d, i) => {
      const semantic = cosine(q, vectors[i]!);
      const lexicalScore = lex.get(i) ?? 0;
      return {
        title: d.title,
        semantic,
        lexical: lexicalScore,
        blended: SEMANTIC_WEIGHT * semantic + LEXICAL_WEIGHT * lexicalScore,
      };
    })
    .sort((a, b) => b.blended - a.blended);
}

/* The question the demo asks out loud, plus three the corpus can clearly answer. */
const ANSWERABLE: { question: string; expect: RegExp }[] = [
  { question: "why is the expiry window capped", expect: /capped position size/i },
  { question: "why did we stop using the vendor settlement prices", expect: /settlement prices/i },
  { question: "what happens after two losing sessions in a row", expect: /consecutive losing sessions/i },
  { question: "why was the corporate action window excluded", expect: /corporate action/i },
];

const UNANSWERABLE = [
  "what is the capital of france",
  "how do I bake sourdough bread",
  "recommend a film for tonight",
];

describe("hybrid retrieval", () => {
  for (const c of ANSWERABLE) {
    it(`answers "${c.question}" with the record that says it`, async () => {
      const ranked = await rank(c.question);
      expect(ranked[0]!.title).toMatch(c.expect);
      expect(ranked[0]!.blended).toBeGreaterThan(RELEVANCE_FLOOR);
    }, 60_000);
  }

  for (const q of UNANSWERABLE) {
    it(`returns nothing above the floor for "${q}"`, async () => {
      const ranked = await rank(q);
      /* No source, no claim. The nearest few passages are not an answer. */
      expect(ranked[0]!.blended).toBeLessThan(RELEVANCE_FLOOR);
    }, 60_000);
  }

  it("keeps a clear margin between what it can and cannot answer", async () => {
    const worstAnswerable = Math.min(
      ...(await Promise.all(ANSWERABLE.map(async (c) => (await rank(c.question))[0]!.blended))),
    );
    const bestUnanswerable = Math.max(
      ...(await Promise.all(UNANSWERABLE.map(async (q) => (await rank(q))[0]!.blended))),
    );
    /* If this margin ever narrows, the floor is being tuned on noise and one of the two
       populations is about to cross it. */
    expect(worstAnswerable - bestUnanswerable).toBeGreaterThan(0.25);
  }, 120_000);

  it("shows why semantic similarity alone cannot separate them", async () => {
    /* gte-small returns a high cosine for text with nothing to do with the corpus, so a
       semantic only threshold has to be set inside the noise. This is the measurement
       that justifies the lexical half existing at all. */
    const nonsense = await rank("what is the capital of france");
    expect(nonsense[0]!.semantic).toBeGreaterThan(0.6);
    expect(nonsense[0]!.lexical).toBe(0);
  }, 60_000);
});
