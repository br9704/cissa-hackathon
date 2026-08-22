import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TimeMachine.module.css";

export type ReplayItem = { id: string; occurredAt: string; authorMemberId: string; riskFlag: boolean };

/*
  Replays the firm's memory.

  This costs almost nothing to build and that is the point worth making out loud: on an
  append-only ledger, the state at any past moment is just the events up to that moment.
  There is no history table, no snapshotting, no reconstruction. A system that overwrites
  rows cannot do this at all without having decided to keep the old ones, which is the
  same decision this schema made once, at the start, for every row.
*/
export function TimeMachine({
  items,
  resignation,
  onChange,
}: {
  items: ReplayItem[];
  /* The moment the graph starts hemorrhaging: who left, and when. */
  resignation: { memberId: string; on: string; name: string } | null;
  onChange: (state: { visible: Set<string>; atRisk: Set<string>; at: number }) => void;
}) {
  const ordered = useMemo(
    () => items.slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    [items],
  );

  const first = ordered.length ? Date.parse(ordered[0]!.occurredAt) : 0;
  const last = ordered.length ? Date.parse(ordered[ordered.length - 1]!.occurredAt) : 1;
  const span = Math.max(1, last - first);

  const [at, setAt] = useState(last);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  const resignedAt = resignation ? Date.parse(resignation.on) : null;
  const resignedPct =
    resignedAt !== null ? ((resignedAt - first) / span) * 100 : null;

  const state = useMemo(() => {
    const visible = new Set<string>();
    const atRisk = new Set<string>();
    for (const item of ordered) {
      if (Date.parse(item.occurredAt) > at) continue;
      visible.add(item.id);
      /*
        A decision only turns amber once the person who recorded it has actually gone.
        Colouring it from the start would say the risk always existed, which is both
        wrong and much less interesting than watching it arrive.
      */
      if (
        resignation &&
        resignedAt !== null &&
        at >= resignedAt &&
        item.authorMemberId === resignation.memberId
      ) {
        atRisk.add(item.id);
      }
    }
    return { visible, atRisk, at };
  }, [ordered, at, resignation, resignedAt]);

  useEffect(() => {
    onChange(state);
  }, [state, onChange]);

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let previous = performance.now();

    /*
      Wall clock rather than a fixed step per frame, so the replay takes the same twelve
      seconds on a 120Hz display as on a 60Hz one.
    */
    const DURATION_MS = 12_000;

    function tick(now: number) {
      if (cancelled) return;
      const delta = now - previous;
      previous = now;
      setAt((current) => {
        const next = current + (span * delta) / DURATION_MS;
        if (next >= last) {
          setPlaying(false);
          return last;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    }

    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, span, last]);

  function play() {
    /* Restart from the beginning if the scrubber is already at the end. */
    if (at >= last) setAt(first);
    setPlaying((p) => !p);
  }

  const visibleCount = state.visible.size;
  const riskCount = state.atRisk.size;
  const dateLabel = new Date(at).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.date}>{dateLabel}</span>
        <span className={styles.counts}>
          <span className={styles.count}>
            <span className={styles.countValue}>{visibleCount}</span> decisions recorded
          </span>
          <span className={styles.count}>
            <span className={`${styles.countValue} ${riskCount ? styles.countRisk : ""}`}>
              {riskCount}
            </span>{" "}
            with nobody left to explain them
          </span>
        </span>
      </div>

      <div className={styles.trackRow}>
        <button
          type="button"
          className={styles.play}
          onClick={play}
          aria-label={playing ? "Pause the replay" : "Play the replay"}
        >
          {playing ? "❙❙" : "▶"}
        </button>
        <span className={styles.trackWrap}>
          {resignedPct !== null ? (
            <>
              <span className={styles.marker} style={{ left: `${resignedPct}%` }} />
              {/*
                The label anchors to whichever side keeps it on screen. Centring it would
                clip it at both ends of the track, and the resignation is deliberately
                near one end.
              */}
              <span
                className={styles.markerLabel}
                style={
                  resignedPct > 60
                    ? { right: `${100 - resignedPct}%`, paddingRight: 6 }
                    : { left: `${resignedPct}%`, paddingLeft: 6 }
                }
              >
                {resignation!.name} resigns
              </span>
            </>
          ) : null}
          <input
            type="range"
            className={styles.slider}
            min={first}
            max={last}
            value={at}
            step={Math.round(span / 400)}
            onChange={(e) => {
              setPlaying(false);
              setAt(Number(e.target.value));
            }}
            aria-label="Replay the ledger over time"
          />
        </span>
      </div>

      <p className={styles.legend}>
        Replaying the ledger. Nothing is being reconstructed here: on an append-only
        record, the state at a past moment is just the events up to it, so this is the
        same rendering code reading a shorter list. A system that overwrites rows cannot
        do this at all unless it decided to keep the old ones, which is a decision this
        schema made once, at the start, for everything.
      </p>
    </div>
  );
}
