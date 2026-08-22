/*
  Live meeting capture.

  Microphone to raw PCM, cut into utterances by a loudness gate, transcribed incrementally
  in a worker, and handed out as {speaker, text} turns which is exactly the shape the
  transcript importer already accepts.

  THE DESIGN DECISION THAT MATTERS. While somebody is still speaking, this re-transcribes
  the WHOLE open utterance and REPLACES the interim text. It never appends one decode to
  another. That makes the classic live-transcription bug structurally impossible: you
  cannot split a word across a chunk boundary if you never join two chunks. It is only
  affordable because a five second window costs about a quarter of a second, and it is why
  the model choice and this loop had to be decided together.

  Nothing is uploaded and no audio is kept. When the recorder stops, the buffer is
  released and only text survives. That is a product claim, so it is enforced here rather
  than promised in copy.
*/
import type { FromWorker, ToWorker } from "./asr.worker";

const TARGET_SR = 16_000;

/* Moonshine degrades past roughly twenty seconds, so an utterance is cut before then
   whether or not the speaker has paused. Somebody who talks for a minute without drawing
   breath gets several turns, which is a better failure than one wrong one. */
const MAX_UTTERANCE_S = 18;

/* How often the open utterance is re-decoded. Fast enough that text appears while the
   person is still talking; slow enough that decodes do not queue behind each other. */
const INTERIM_EVERY_MS = 1200;

/* Silence this long ends the utterance. Shorter and a mid-sentence breath cuts a turn in
   half; longer and the last sentence of a meeting hangs unfiled. */
const SILENCE_HANGOVER_MS = 700;

/* Loudness gate, with hysteresis so a voice hovering at the threshold does not chatter
   the gate open and shut. Tuned against a quiet room; expose them if a desk is louder. */
const RMS_OPEN = 0.012;
const RMS_CLOSE = 0.006;

/* Thirty minutes. The buffer is 64 kB per second, so this caps it at about 115 MB, and
   an unbounded buffer in a tab that somebody left recording overnight is a crash. */
export const MAX_RECORDING_S = 30 * 60;

export type LiveTurn = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

export type RecorderFailure =
  | "denied"
  | "insecure"
  | "device"
  | "model"
  | "ended"
  | "limit";

export type RecorderEvents = {
  onInterim: (text: string) => void;
  onTurn: (turn: LiveTurn) => void;
  onLevel: (rms: number) => void;
  onModelProgress: (pct: number) => void;
  onModelReady: () => void;
  onError: (kind: RecorderFailure, detail: string) => void;
};

export class MeetingRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private worker: Worker | null = null;

  /* The whole recording at 16 kHz. Kept in memory only, released on stop. */
  private buffer = new Float32Array(TARGET_SR * 60);
  private length = 0;

  private utteranceStart = 0;
  private open = false;
  private lastVoiceAt = 0;
  private lastInterimAt = 0;
  private requestId = 0;
  private pendingFinalId: number | null = null;

  constructor(private readonly events: RecorderEvents) {}

  get seconds(): number {
    return this.length / TARGET_SR;
  }

  async start(): Promise<boolean> {
    if (!window.isSecureContext) {
      this.events.onError("insecure", "Recording needs https or localhost.");
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.events.onError("device", "This browser exposes no microphone.");
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        /*
          Do not retry. Once denied, the prompt will not appear again until the person
          clears the site permission themselves, so a retry loop just spins.
        */
        this.events.onError("denied", "Microphone access was refused.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        this.events.onError("device", "No microphone was found.");
      } else {
        this.events.onError("device", String(err));
      }
      return false;
    }

    /* A track can end without the page doing anything: the device is unplugged, or the
       OS revokes access. Commit what exists rather than silently recording nothing. */
    for (const track of this.stream.getAudioTracks()) {
      track.onended = () => {
        this.events.onError("ended", "The microphone stopped.");
        void this.stop();
      };
    }

    this.ctx = new AudioContext({ sampleRate: TARGET_SR, latencyHint: "interactive" });
    if (this.ctx.state === "suspended") await this.ctx.resume();

    await this.ctx.audioWorklet.addModule(new URL("./mic-worklet.js", import.meta.url));

    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "capture", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
    });

    /* Ask for 16 kHz and check rather than trust: some platforms quietly refuse the rate
       and hand back 48 kHz, and feeding a model 48 kHz audio it thinks is 16 kHz produces
       confident nonsense at three times the speed. */
    const ratio = this.ctx.sampleRate / TARGET_SR;
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      this.onFrame(ratio === 1 ? e.data : resample(e.data, ratio));
    };
    source.connect(this.node);

    this.worker = new Worker(new URL("./asr.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.onWorkerMessage(e.data);
    this.send({ type: "load" });
    return true;
  }

  private send(message: ToWorker): void {
    if (!this.worker) return;
    this.worker.postMessage(
      message,
      message.type === "transcribe" ? [message.pcm.buffer] : [],
    );
  }

  private onFrame(pcm: Float32Array): void {
    if (this.seconds >= MAX_RECORDING_S) {
      this.events.onError("limit", "Recording limit reached. File this and start another.");
      void this.stop();
      return;
    }

    if (this.length + pcm.length > this.buffer.length) this.grow();
    this.buffer.set(pcm, this.length);
    this.length += pcm.length;

    let sum = 0;
    for (let i = 0; i < pcm.length; i++) sum += pcm[i]! * pcm[i]!;
    const rms = Math.sqrt(sum / pcm.length);
    this.events.onLevel(rms);

    const now = performance.now();

    if (!this.open) {
      if (rms <= RMS_OPEN) return;
      this.open = true;
      /* Rewind 300ms, or the gate eats the first consonant of every sentence. */
      this.utteranceStart = Math.max(0, this.length - pcm.length - TARGET_SR * 0.3);
      this.lastVoiceAt = now;
      this.lastInterimAt = now;
      return;
    }

    if (rms > RMS_CLOSE) this.lastVoiceAt = now;

    const tooLong = this.length - this.utteranceStart >= TARGET_SR * MAX_UTTERANCE_S;
    const silent = now - this.lastVoiceAt >= SILENCE_HANGOVER_MS;

    if (silent || tooLong) {
      this.dispatch(true);
      this.open = false;
      return;
    }

    if (now - this.lastInterimAt >= INTERIM_EVERY_MS) {
      this.lastInterimAt = now;
      this.dispatch(false);
    }
  }

  /* Always the whole open utterance, never a delta. See the note at the top. */
  private dispatch(final: boolean): void {
    const pcm = this.buffer.slice(this.utteranceStart, this.length);
    if (pcm.length < TARGET_SR * 0.4) return;
    const id = ++this.requestId;
    if (final) this.pendingFinalId = id;
    this.send({ type: "transcribe", id, pcm, final });
  }

  private onWorkerMessage(message: FromWorker): void {
    if (message.type === "progress") return this.events.onModelProgress(message.pct);
    if (message.type === "ready") return this.events.onModelReady();
    if (message.type === "error") return this.events.onError("model", message.message);
    if (message.type !== "result") return;

    /* A slow interim can land after a newer one was requested. Drop it rather than
       letting the text jump backwards. */
    if (!message.final && message.id < this.requestId) return;

    if (message.final && message.id === this.pendingFinalId) {
      this.pendingFinalId = null;
      if (message.text) {
        this.events.onTurn({
          speaker: "Speaker A",
          text: message.text,
          start: this.utteranceStart / TARGET_SR,
          end: this.length / TARGET_SR,
        });
      }
      this.events.onInterim("");
      return;
    }

    this.events.onInterim(message.text);
  }

  private grow(): void {
    const next = new Float32Array(this.buffer.length * 2);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }

  /** The recording so far, for the speaker pass. In memory only. */
  audio(): Float32Array {
    return this.buffer.subarray(0, this.length);
  }

  async stop(): Promise<void> {
    if (this.open) {
      this.dispatch(true);
      this.open = false;
    }
    this.node?.port.close();
    this.node?.disconnect();
    this.stream?.getAudioTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.node = null;
    this.stream = null;
  }

  /** Release the audio. Called when the recorder unmounts or the turns are filed. */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.buffer = new Float32Array(0);
    this.length = 0;
  }
}

/**
 * Linear resample down to 16 kHz.
 *
 * Adequate for speech at 48k to 16k, and deliberately not a windowed sinc: the model was
 * trained on telephone-band speech and cannot tell the difference, and a proper filter
 * here would be effort spent where nothing can hear it.
 */
function resample(input: Float32Array, ratio: number): Float32Array {
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const frac = position - index;
    const a = input[index] ?? 0;
    const b = input[index + 1] ?? a;
    out[i] = a * (1 - frac) + b * frac;
  }
  return out;
}
