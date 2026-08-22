/*
  Who said what.

  Two small models, and the split between them is the whole idea: one is good at finding
  the moment a voice changed, the other is good at recognising a voice, and neither knows
  anybody's name. A person supplies the names, which is the point at which a model's guess
  becomes a record.

  Measured in a real browser on this machine, both on WASM with no GPU:
    pyannote-segmentation-3.0 q8   1.5 MB   0.10s per 10 second window
    wespeaker-voxceleb-resnet34    6.7 MB   0.11s per 3 second segment

  8 MB and a fifth of a second per ten seconds of audio, which is why this runs at all
  rather than being a thing the product apologises for not having.
*/

export type DiarisedSegment = { start: number; end: number; cluster: number };

const SR = 16_000;

/* pyannote 3.0 is trained on 10 second windows. Feed it anything else and the frame
   classifier is working outside its distribution. */
const WINDOW_S = 10;

/* Below this there is not enough voice to embed reliably, and a bad embedding pollutes a
   cluster centroid permanently. */
const MIN_SEGMENT_S = 0.6;

/*
  Cosine similarity above which two segments are the same person.

  NOT measured on trading desk audio, which is the honest caveat: it was chosen from the
  model card and checked against a two speaker sample. Too low and two people merge into
  one, which understates how many voices were in the room. Too high and one person splits
  across three clusters, which is visible and annoying and gets fixed by a human in the
  naming step. Erring high is the better failure.
*/
const SAME_SPEAKER = 0.6;

type FrameSegment = { id: number; start: number; end: number; confidence: number };

export type DiariseProgress = (done: number, total: number) => void;

/**
 * Speaker turns for a whole recording.
 *
 * Runs after the meeting, not during it. Live turns are labelled Speaker A by the
 * recorder and relabelled here in one visible pass, because attempting identity live
 * means every early turn gets revised in front of the person watching.
 */
export async function diarise(
  audio: Float32Array,
  onProgress?: DiariseProgress,
): Promise<DiarisedSegment[]> {
  const { AutoProcessor, AutoModelForAudioFrameClassification, AutoModel, env } =
    await import("@huggingface/transformers");
  env.allowLocalModels = false;

  const segmentationId = "onnx-community/pyannote-segmentation-3.0";
  const segmentation = await AutoModelForAudioFrameClassification.from_pretrained(
    segmentationId,
    { dtype: "q8" },
  );
  /*
    Cast, because the library's Processor type is the union of every processor and does
    not narrow to the speaker-diarization one from the model id alone. The method is real
    and is what the pyannote processor exists to provide; the types just cannot see it.
  */
  const segmentationProcessor = (await AutoProcessor.from_pretrained(segmentationId)) as unknown as {
    (audio: Float32Array): Promise<Record<string, unknown>>;
    post_process_speaker_diarization: (logits: unknown, samples: number) => FrameSegment[][];
  };

  const speakerId = "onnx-community/wespeaker-voxceleb-resnet34-LM";
  const speaker = await AutoModel.from_pretrained(speakerId, { dtype: "q8" });
  const speakerProcessor = (await AutoProcessor.from_pretrained(speakerId)) as unknown as (
    audio: Float32Array,
  ) => Promise<Record<string, unknown>>;

  // --- 1. Where did the voice change.
  const windows = Math.ceil(audio.length / (SR * WINDOW_S));
  const raw: FrameSegment[] = [];

  for (let w = 0; w < windows; w++) {
    const offset = w * SR * WINDOW_S;
    const window = audio.subarray(offset, Math.min(offset + SR * WINDOW_S, audio.length));
    if (window.length < SR) break;

    const inputs = await segmentationProcessor(window);
    const { logits } = (await segmentation(inputs)) as { logits: unknown };
    const segments = segmentationProcessor.post_process_speaker_diarization(
      logits,
      window.length,
    )[0] as FrameSegment[];

    const base = offset / SR;
    for (const s of segments) raw.push({ ...s, start: s.start + base, end: s.end + base });

    onProgress?.(w + 1, windows);
    /* Yield so the tab can paint. A thirty minute meeting is 180 windows and without
       this the page freezes for the whole pass. */
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /*
    Class 0 is non-speech in pyannote's powerset encoding, and the remaining ids are only
    meaningful WITHIN one window: id 1 in the first window and id 1 in the second are not
    the same person. So the ids are used to glue adjacent frames and then thrown away, and
    identity comes entirely from the embeddings below.
  */
  const speech = raw.filter((s) => s.id !== 0);
  const merged: FrameSegment[] = [];
  for (const s of speech) {
    const last = merged[merged.length - 1];
    if (last && last.id === s.id && s.start - last.end < 0.2) last.end = s.end;
    else merged.push({ ...s });
  }

  // --- 2. Whose voice is it.
  const centroids: Float32Array[] = [];
  const counts: number[] = [];
  const out: DiarisedSegment[] = [];

  for (let i = 0; i < merged.length; i++) {
    const s = merged[i]!;
    if (s.end - s.start < MIN_SEGMENT_S) continue;

    const slice = audio.subarray(Math.floor(s.start * SR), Math.floor(s.end * SR));
    const inputs = await speakerProcessor(slice);
    const result = (await speaker(inputs)) as Record<string, { data: ArrayLike<number> }>;
    const source = (result.last_hidden_state ?? result.embeddings) as { data: ArrayLike<number> };
    const embedding = normalise(new Float32Array(source.data));

    let best = -1;
    let bestScore = -1;
    for (let c = 0; c < centroids.length; c++) {
      const score = dot(embedding, centroids[c]!);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (best === -1 || bestScore < SAME_SPEAKER) {
      centroids.push(embedding);
      counts.push(1);
      best = centroids.length - 1;
    } else {
      /* Running mean, so a cluster gets more confident as it hears more of a voice
         rather than being pinned to whatever the first segment sounded like. */
      const centroid = centroids[best]!;
      const n = counts[best]!;
      for (let k = 0; k < centroid.length; k++) {
        centroid[k] = (centroid[k]! * n + embedding[k]!) / (n + 1);
      }
      centroids[best] = normalise(centroid);
      counts[best] = n + 1;
    }

    out.push({ start: s.start, end: s.end, cluster: best });
    if (i % 8 === 7) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return out;
}

/**
 * Attach a speaker to each transcribed turn, by which cluster overlaps it most.
 *
 * Overlap rather than midpoint, because a turn that straddles a handover belongs to
 * whoever was talking for most of it, and a midpoint test gets that wrong exactly at the
 * boundaries where it matters.
 */
export function labelTurns<T extends { start: number; end: number }>(
  turns: T[],
  segments: DiarisedSegment[],
): (T & { speaker: string })[] {
  const name = (index: number) => `Speaker ${String.fromCharCode(65 + index)}`;

  return turns.map((turn) => {
    const overlap = new Map<number, number>();
    for (const segment of segments) {
      const shared = Math.min(turn.end, segment.end) - Math.max(turn.start, segment.start);
      if (shared > 0) overlap.set(segment.cluster, (overlap.get(segment.cluster) ?? 0) + shared);
    }

    let best = -1;
    let bestShared = 0;
    for (const [cluster, shared] of overlap) {
      if (shared > bestShared) {
        best = cluster;
        bestShared = shared;
      }
    }

    return { ...turn, speaker: best === -1 ? "Unattributed" : name(best) };
  });
}

function normalise(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i]! * v[i]!;
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] = v[i]! / norm;
  return v;
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}
