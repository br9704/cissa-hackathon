/*
  Semantic retrieval, in the browser.

  The model runs on the machine looking at the page. No API key, no round trip, and no
  text leaving the tab, which is not a limitation to work around here but the thing the
  whole product is arguing for: if the reasoning behind a strategy can be searched
  without it leaving the building, then the on premise story is a demonstration rather
  than a slide.

  384 dimensions, matching the pgvector column exactly. That is not a coincidence: the
  schema was pinned at 384 on every path so this model and OpenAI's text-embedding-3-small
  with dimensions=384 produce vectors the same column can hold. What 384 everywhere does
  NOT do is make them interchangeable, because they are different vector spaces, which is
  why every embedded row records which model produced it and retrieval filters on it.

  The library is loaded with a dynamic import. onnxruntime-web is several megabytes and
  most sessions never ask a question, so it is fetched the first time somebody does
  rather than paid for on every page load.
*/

export const EMBEDDING_MODEL = "Supabase/gte-small";
export const EMBEDDING_DIMS = 384;

type Extractor = (
  text: string | string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

let extractorPromise: Promise<Extractor> | null = null;

export type LoadState = "idle" | "loading" | "ready" | "failed";

/**
 * Load the model once per session.
 *
 * Deliberately not preloaded. Fetching megabytes of runtime on a page nobody has asked a
 * question on would trade a real cost for a hypothetical benefit.
 */
export function loadExtractor(onProgress?: (pct: number) => void): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      /* Browser only. The Node backend is installed as a peer of the package and would
         never resolve here anyway, but saying so keeps the bundle honest. */
      env.allowLocalModels = false;
      const pipe = await pipeline("feature-extraction", EMBEDDING_MODEL, {
        dtype: "q8",
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            onProgress?.(Math.round(p.progress));
          }
        },
      });
      return pipe as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

export async function embed(text: string): Promise<Float32Array> {
  const extractor = await loadExtractor();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return out.data;
}

export async function embedMany(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Float32Array[]> {
  const extractor = await loadExtractor();
  const out: Float32Array[] = [];
  /*
    One at a time rather than one big batch. A batch is faster and holds the whole corpus
    in memory at once; stepping through it keeps the tab responsive and lets the UI show
    real progress instead of freezing and then finishing.
  */
  for (let i = 0; i < texts.length; i++) {
    const r = await extractor(texts[i]!, { pooling: "mean", normalize: true });
    out.push(new Float32Array(r.data));
    onProgress?.(i + 1, texts.length);
    /* Yield to the event loop so the progress actually paints. */
    if (i % 8 === 7) await new Promise((res) => setTimeout(res, 0));
  }
  return out;
}

/**
 * Cosine similarity.
 *
 * The vectors come back L2 normalised, so this is a dot product and the normalisation
 * terms would both be 1. It divides anyway, because a silent wrong answer when somebody
 * later passes an unnormalised vector is worse than a few multiplications.
 */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cannot compare ${a.length} dimensions with ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
