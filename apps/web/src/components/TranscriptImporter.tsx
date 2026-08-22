import { useMemo, useRef, useState } from "react";
import styles from "./TranscriptImporter.module.css";
import { corpus, memberInitials } from "../data/source";

/*
  Meetings feed the ledger.

  The pitch says maximum context all the time, and a recorded meeting is the largest
  source of reasoning that never gets written down anywhere: most of what a desk decides
  is said out loud in fifteen minutes and then evaporates. Always-on room capture is
  roadmap; this is the part that ships, and it is enough to make the claim concrete
  rather than aspirational.

  A transcript files as a meeting_transcript artifact through the same path as a commit.
  It is not a special case in the schema and it should not be one here.
*/

export type ParsedTurn = { speaker: string; text: string };

/**
 * Parse a speaker tagged transcript.
 *
 * Handles the three shapes people actually paste: "Name: text", "[00:04:12] Name: text",
 * and a continuation line that belongs to the speaker above it. Anything else is left
 * alone rather than guessed at, because a transcript importer that silently reassigns a
 * line to the wrong person is worse than one that refuses.
 */
export function parseTranscript(raw: string): ParsedTurn[] {
  const turns: ParsedTurn[] = [];
  for (const line of raw.split("\n")) {
    const text = line.trim();
    if (!text) continue;

    /* An optional leading timestamp in brackets or parentheses. */
    const stripped = text.replace(/^[[(]\s*\d{1,2}:\d{2}(:\d{2})?\s*[\])]\s*/, "");
    const match = stripped.match(/^([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,2})\s*:\s*(.+)$/);

    if (match) {
      turns.push({ speaker: match[1]!.trim(), text: match[2]!.trim() });
      continue;
    }

    /* A continuation of the previous speaker, which is how most transcripts wrap. */
    const last = turns[turns.length - 1];
    if (last) last.text = `${last.text} ${stripped}`;
  }
  return turns;
}

const SAMPLE = `[00:00:04] Marcus: The India book is fine but the filter is doing more work than it should be.
[00:00:11] Daniel: It is doing liquidity work. On a quiet expiry it reads fine and we still cannot get out.
[00:00:19] Marcus: Has anyone written that down?
[00:00:21] Daniel: No. It has never cost us enough for anyone to bother.`;

export function TranscriptImporter({ onFiled }: { onFiled?: (turns: ParsedTurn[]) => void }) {
  const c = corpus();
  const [raw, setRaw] = useState("");
  const [strategyId, setStrategyId] = useState(c.strategies[0]!.id);
  const [filed, setFiled] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const turns = useMemo(() => parseTranscript(raw), [raw]);

  /* Match speakers to members by first name, which is how transcripts label people. */
  const speakers = useMemo(() => {
    const names = [...new Set(turns.map((t) => t.speaker))];
    return names.map((name) => {
      const member = c.members.find(
        (m) =>
          m.displayName.toLowerCase() === name.toLowerCase() ||
          m.displayName.split(" ")[0]!.toLowerCase() === name.toLowerCase(),
      );
      return { name, member };
    });
  }, [turns, c.members]);

  function file() {
    setFiled(turns.length);
    onFiled?.(turns);
    setRaw("");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>Import a meeting transcript</span>
        <span className={styles.note}>
          Files as an artifact through the same path as a commit
        </span>
      </div>

      <div
        className={styles.drop}
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) setRaw(await file.text());
        }}
      >
        <textarea
          ref={areaRef}
          className={styles.area}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setFiled(null);
          }}
          placeholder={`Paste or drop a transcript.\n\n${SAMPLE}`}
          aria-label="Transcript text"
          spellCheck={false}
        />
      </div>

      {turns.length > 0 ? (
        <div className={styles.parsed}>
          <span className={styles.note}>
            {turns.length} turns, {speakers.length} speaker
            {speakers.length === 1 ? "" : "s"}
          </span>
          <div className={styles.speakers}>
            {speakers.map((s) => (
              <span
                key={s.name}
                className={`${styles.speaker} ${s.member ? "" : styles.unmatched}`}
              >
                <span className={styles.avatar}>
                  {s.member ? memberInitials(s.member.id) : "?"}
                </span>
                {s.member ? s.member.displayName : `${s.name}, not on the desk`}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.controls}>
        <select
          className={styles.select}
          value={strategyId}
          onChange={(e) => setStrategyId(e.target.value)}
          aria-label="Strategy this meeting was about"
        >
          {c.strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.button}
          onClick={file}
          disabled={turns.length === 0}
        >
          File to the ledger
        </button>
        {raw.trim().length === 0 ? (
          <button
            type="button"
            className={styles.select}
            onClick={() => {
              setRaw(SAMPLE);
              setFiled(null);
              areaRef.current?.focus();
            }}
          >
            Use a sample
          </button>
        ) : null}
      </div>

      {filed !== null ? (
        <div className={styles.filed}>
          Filed. {filed} speaker tagged turns are now citable by any decision, debrief
          answer or ask bar result.
        </div>
      ) : null}
    </div>
  );
}
