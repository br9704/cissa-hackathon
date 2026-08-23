import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./CaptureSheet.module.css";
import { Recorder } from "./Recorder";
import { TranscriptImporter, type ParsedTurn } from "./TranscriptImporter";
import { capture } from "../data/capture";
import { corpus } from "../data/source";

/*
  Every way into the ledger, in one place, one keystroke from anywhere.

  The critique found the recorder, the importer and the tagger sitting under a heading two
  thirds of the way down a page holding 184 rows. The product did a great deal and performed
  none of it. This is the fix, and it deliberately MOUNTS the existing Recorder and
  TranscriptImporter rather than reimplementing them: they already work, they are already
  tested, and a second implementation would be a second set of bugs.
*/

type Tab = "note" | "meeting" | "transcript";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "note", label: "Write it down", hint: "thirty seconds, while you remember" },
  { id: "meeting", label: "Record a meeting", hint: "transcribed in this browser" },
  { id: "transcript", label: "Import a transcript", hint: "paste or drop a file" },
];

export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("note");
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [strategyId, setStrategyId] = useState<string>("");
  const [filed, setFiled] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const strategies = corpus().strategies;

  /* Focus before paint, for the same reason the ask palette does: a frame where the dialog
     is visible and nothing is focused is a frame where keystrokes land on the page behind. */
  useLayoutEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setFiled(null);
      setTitle("");
      setWhy("");
    }
  }, [open]);

  if (!open) return null;

  function fileNote() {
    const trimmed = why.trim();
    if (!trimmed) return;
    const row = capture({
      channel: "note",
      /* A record with no title is a record nobody finds again, so the first clause of the
         reasoning stands in when the writer did not give one. */
      title: title.trim() || trimmed.split(/[.;]/)[0]!.slice(0, 72),
      body: trimmed,
      strategyId: strategyId || null,
    });
    setFiled(row.title);
    setTitle("");
    setWhy("");
  }

  function fromTurns(channel: "meeting" | "transcript") {
    return (turns: ParsedTurn[]) => {
      if (turns.length === 0) return;
      const body = turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
      const row = capture({
        channel,
        title: `${channel === "meeting" ? "Meeting" : "Transcript"}, ${turns.length} turns`,
        body,
        strategyId: strategyId || null,
        /* Nothing here has been read by a person yet, so it is a draft and says so. */
        draftedBy: "model",
      });
      setFiled(row.title);
    };
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="New record"
      >
        <div className={styles.head}>
          <span className={styles.title}>New record</span>
          <span className={styles.subtitle}>
            It goes to the inbox first. Nothing reaches the ledger unread.
          </span>
          <span className={styles.spacer} />
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Capture channel">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-active={tab === t.id}
              className={styles.tab}
              onClick={() => setTab(t.id)}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {tab === "note" ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>What changed</span>
                <input
                  ref={titleRef}
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Capped position size in the expiry window"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Why</span>
                <textarea
                  className={styles.textarea}
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="The reasoning, in your words. This is the part that disappears when someone leaves."
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Book</span>
                <select
                  className={styles.select}
                  value={strategyId}
                  onChange={(e) => setStrategyId(e.target.value)}
                >
                  <option value="">Not book specific</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={fileNote}
                  disabled={!why.trim()}
                >
                  Send to inbox
                </button>
                {filed ? (
                  <span className={styles.filed}>Captured: {filed}</span>
                ) : (
                  <span className={styles.hint}>Synthetic demo data. Nothing here is real.</span>
                )}
              </div>
            </>
          ) : null}

          {tab === "meeting" ? <Recorder onFiled={fromTurns("meeting")} /> : null}
          {tab === "transcript" ? (
            <TranscriptImporter onFiled={fromTurns("transcript")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
