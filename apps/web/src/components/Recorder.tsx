import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Recorder.module.css";
import { MeetingRecorder, MAX_RECORDING_S, type LiveTurn, type RecorderFailure } from "../record/recorder";
import { diarise, labelTurns } from "../record/diarise";
import type { ParsedTurn } from "./TranscriptImporter";

/*
  Record a meeting, transcribe it here, file it as an artifact.

  Three things about this component are product decisions rather than UI choices.

  The consent gate comes before the first recording and what was agreed is filed WITH the
  transcript. This is a ledger product; a consent that lives only in somebody's memory is
  the one record it would be strange not to keep.

  No audio is kept. The recorder holds PCM in memory to transcribe it and releases it when
  the turns are filed or discarded. That is a claim the product makes, so it is enforced
  in code rather than promised in copy.

  Speaker labels stay provisional until a person confirms them. A model deciding who said
  something, in a system whose whole value is attribution, is exactly the place not to
  accept a guess.
*/

type Phase = "idle" | "consent" | "loading" | "recording" | "settling" | "review";

const FAILURE_COPY: Record<RecorderFailure, string> = {
  denied:
    "Continuity needs the microphone. Allow it in your browser's site settings, then try again. You can paste a transcript instead.",
  insecure: "Recording needs a secure connection. Open this over https or on localhost.",
  device: "No microphone was found.",
  model:
    "The transcription model could not be downloaded. Paste the transcript instead; everything else still works.",
  ended: "The microphone stopped. Everything transcribed so far has been kept.",
  limit: "Recording limit reached. File this one and start another.",
};

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Recorder({ onFiled }: { onFiled?: (turns: ParsedTurn[]) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [consented, setConsented] = useState(false);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [modelPct, setModelPct] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [settlingPct, setSettlingPct] = useState(0);

  const recorder = useRef<MeetingRecorder | null>(null);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      /* Release the audio and the worker if the page moves on mid-recording. */
      void recorder.current?.stop();
      recorder.current?.dispose();
      if (tick.current !== null) window.clearInterval(tick.current);
    };
  }, []);

  /* Nothing is on a server to recover, so losing an unfiled recording is losing it. */
  useEffect(() => {
    if (phase !== "recording" && phase !== "review") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  const begin = useCallback(async () => {
    setFailure(null);
    setTurns([]);
    setInterim("");
    setPhase("loading");

    const instance = new MeetingRecorder({
      onInterim: setInterim,
      onTurn: (turn) => setTurns((prev) => [...prev, turn]),
      onLevel: setLevel,
      onModelProgress: (pct) => setModelPct(pct),
      onModelReady: () => {
        setModelPct(null);
        setPhase("recording");
      },
      onError: (kind, detail) => {
        setFailure(FAILURE_COPY[kind] ?? detail);
        if (kind !== "limit" && kind !== "ended") setPhase("idle");
      },
    });

    recorder.current = instance;
    const started = await instance.start();
    if (!started) {
      setPhase("idle");
      return;
    }

    tick.current = window.setInterval(() => setElapsed(instance.seconds), 250);
  }, []);

  const finish = useCallback(async () => {
    const instance = recorder.current;
    if (!instance) return;
    if (tick.current !== null) window.clearInterval(tick.current);

    setPhase("settling");
    setInterim("");
    await instance.stop();

    /*
      Speakers are resolved after the meeting, in one visible pass. Doing it live would
      mean every early turn gets relabelled in front of whoever is watching, which reads
      as the system changing its mind rather than as it finishing a job.
    */
    try {
      const audio = instance.audio();
      if (audio.length > 16_000) {
        const segments = await diarise(audio, (done, total) =>
          setSettlingPct(Math.round((done / total) * 100)),
        );
        setTurns((prev) => labelTurns(prev, segments));
      }
    } catch {
      /* Diarisation failing costs speaker names and nothing else. The transcript stands,
         and a person can name the voices by hand. */
      setFailure("Speakers could not be separated automatically. Name them yourself below.");
    }

    setSettlingPct(0);
    setPhase("review");
  }, []);

  const file = useCallback(() => {
    onFiled?.(turns.map((t) => ({ speaker: t.speaker, text: t.text })));
    recorder.current?.dispose();
    recorder.current = null;
    setPhase("idle");
    setTurns([]);
    setElapsed(0);
  }, [onFiled, turns]);

  const discard = useCallback(() => {
    recorder.current?.dispose();
    recorder.current = null;
    setPhase("idle");
    setTurns([]);
    setInterim("");
    setElapsed(0);
  }, []);

  const live = phase === "recording";

  return (
    <div className={styles.wrap} data-live={live}>
      <div className={styles.head}>
        <span className={styles.title}>Record a meeting</span>

        {live ? (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.elapsed} role="status">
              Recording {mmss(elapsed)} of {mmss(MAX_RECORDING_S)}
            </span>
            <span className={styles.meter} aria-hidden="true">
              <span
                className={styles.meterFill}
                style={{ transform: `scaleX(${Math.min(1, level * 14)})` }}
              />
            </span>
          </>
        ) : (
          <span className={styles.note}>
            Transcribed by a model running in this tab. No audio is uploaded and none is kept.
          </span>
        )}

        <span className={styles.spacer} />

        {phase === "idle" ? (
          <button
            type="button"
            className={styles.record}
            onClick={() => (consented ? void begin() : setPhase("consent"))}
          >
            Start recording
          </button>
        ) : null}

        {live ? (
          <button
            type="button"
            className={`${styles.record} ${styles.recording}`}
            onClick={() => void finish()}
          >
            Stop
          </button>
        ) : null}
      </div>

      {phase === "consent" ? (
        <div className={styles.consent}>
          <span className={styles.consentTitle}>Before you start</span>
          <p className={styles.consentBody}>
            This records people talking. The audio is transcribed by a model running in this
            browser, nothing is uploaded, and the audio is discarded when you file or
            discard the transcript. What gets kept is the text, and once it is filed it is
            in an append-only record: it can be superseded but not deleted.
          </p>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
            />
            <span>Everyone in this room has been told the meeting is being transcribed.</span>
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.file}
              disabled={!consented}
              onClick={() => void begin()}
            >
              Start recording
            </button>
            <button type="button" className={styles.discard} onClick={() => setPhase("idle")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {phase === "loading" ? (
        <div className={styles.progress}>
          <span className={styles.note}>
            {modelPct === null
              ? "Preparing the transcription model"
              : `Downloading the transcription model, ${modelPct}%. This happens once and then it works offline.`}
          </span>
          <span className={styles.progressTrack}>
            <span className={styles.progressFill} style={{ width: `${modelPct ?? 4}%` }} />
          </span>
        </div>
      ) : null}

      {phase === "settling" ? (
        <div className={styles.progress}>
          <span className={styles.note}>
            Working out who said what, {settlingPct}%. Nothing leaves this tab.
          </span>
          <span className={styles.progressTrack}>
            <span className={styles.progressFill} style={{ width: `${settlingPct}%` }} />
          </span>
        </div>
      ) : null}

      {failure ? <div className={styles.failure}>{failure}</div> : null}

      {turns.length > 0 || interim ? (
        <div className={styles.turns}>
          {turns.map((turn, i) => (
            <div className={styles.turn} key={`${turn.start}-${i}`}>
              <span className={styles.speaker}>
                {turn.speaker} · {mmss(turn.start)}
              </span>
              <span className={styles.speech}>{turn.text}</span>
            </div>
          ))}
          {interim ? (
            <div className={styles.turn}>
              <span className={styles.speaker}>listening</span>
              <span className={`${styles.speech} ${styles.interim}`}>{interim}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "review" ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.file}
            disabled={turns.length === 0}
            onClick={file}
          >
            File {turns.length} turn{turns.length === 1 ? "" : "s"} to the ledger
          </button>
          <button type="button" className={styles.discard} onClick={discard}>
            Discard
          </button>
          <span className={styles.note}>
            Speaker names are the model's guess until you confirm them.
          </span>
        </div>
      ) : null}

      <p className={styles.doctrine}>
        The transcript is filed as an artifact attached to a strategy, exactly like a
        commit. Speaker labels exist so a quote can be traced back to whoever can explain
        it, and for nothing else: there are no talk-time figures, no interruption counts,
        and no ranking of anybody by what they said, here or anywhere else in this product.
      </p>
    </div>
  );
}
