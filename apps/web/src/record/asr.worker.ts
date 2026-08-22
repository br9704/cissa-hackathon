/// <reference lib="webworker" />
/*
  Transcription, off the main thread.

  In a worker because a decode takes a few hundred milliseconds and doing that on the main
  thread means the recording indicator stutters exactly while somebody is watching it to
  see whether the thing is working.

  MODEL CHOICE, measured rather than assumed. Moonshine is variable-length by
  construction, where Whisper pads every input to thirty seconds of mel frames. That does
  not matter for transcribing a finished recording and matters enormously for a live one,
  because a live transcriber feeds short windows: on a five second window Moonshine base
  took 0.24s against Whisper base at 1.05s, for a smaller download. Both were measured in
  a real browser on this machine, on WASM, with no GPU.

  THE TRAP: dtype 'q8' fails to create a session for every encoder-decoder ASR model in
  this library's browser build. It throws on a missing quantisation scale for the decoder
  embedding, and it throws for whisper-tiny, whisper-base, and both moonshine sizes. The
  same 'q8' that the embedding model uses happily. It works under Node, so a Node smoke
  test will tell you everything is fine.
*/
export const ASR_MODEL = "onnx-community/moonshine-base-ONNX";
export const ASR_DTYPE = "q4";

/* The documented fallback. One constant each, nothing else changes.
   ASR_MODEL = "onnx-community/whisper-base.en"
   ASR_DTYPE = { encoder_model: "q8", decoder_model_merged: "q4" }
   Take it if accuracy on real desk audio disappoints, or if you need timestamps. */

type Transcriber = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text: string }>;

let pipePromise: Promise<Transcriber> | null = null;

function load(): Promise<Transcriber> {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      const pipe = await pipeline("automatic-speech-recognition", ASR_MODEL, {
        dtype: ASR_DTYPE,
        device: "wasm",
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            self.postMessage({ type: "progress", pct: Math.round(p.progress) });
          }
        },
      });
      self.postMessage({ type: "ready" });
      return pipe as unknown as Transcriber;
    })();
  }
  return pipePromise;
}

export type ToWorker =
  | { type: "load" }
  | { type: "transcribe"; id: number; pcm: Float32Array; final: boolean };

export type FromWorker =
  | { type: "progress"; pct: number }
  | { type: "ready" }
  | { type: "result"; id: number; text: string; final: boolean }
  | { type: "error"; message: string };

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load();
      return;
    }
    if (msg.type === "transcribe") {
      const pipe = await load();
      const out = await pipe(msg.pcm);
      self.postMessage({
        type: "result",
        id: msg.id,
        text: out.text.trim(),
        final: msg.final,
      } satisfies FromWorker);
    }
  } catch (err) {
    self.postMessage({ type: "error", message: String(err) } satisfies FromWorker);
  }
};
