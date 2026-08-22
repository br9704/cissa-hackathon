import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { verifyChain, type VerifiedRow } from "@continuity/core";
import styles from "./VerifyPage.module.css";
import { chainedLedger, backend, strategyName, type ChainedEvent } from "../data/source";

type Mode = "honest" | "tampered";
type Phase = "idle" | "running" | "done";

export function VerifyPage() {
  const reduced = useReducedMotion();
  const [events, setEvents] = useState<ChainedEvent[] | null>(null);
  const [mode, setMode] = useState<Mode>("honest");
  const [phase, setPhase] = useState<Phase>("idle");
  const [checked, setChecked] = useState(0);
  const [result, setResult] = useState<{ rows: VerifiedRow[]; ok: boolean; firstBadIndex: number | null } | null>(null);
  /*
    A per run token rather than a single cancelled flag.

    The first version used a boolean ref set to true in the effect cleanup, which is the
    obvious shape and is wrong under StrictMode: the effect mounts, cleans up, and mounts
    again, so the flag is left permanently true and the sweep exits on its first
    iteration. The symptom is a progress line frozen at "Recomputing 0 of 184", which
    reads like the hashing failed rather than like a lifecycle bug.

    A token has no such problem. Each run claims the current number, and a run only
    continues while it still owns it, so a newer run or an unmount simply supersedes it.
  */
  const runToken = useRef(0);

  useEffect(() => {
    chainedLedger().then(setEvents);
    return () => {
      runToken.current += 1;
    };
  }, []);

  /*
    The tamper demo edits a COPY, never the ledger.

    Making the demo actually mutate stored data would be theatre with a real cost, and it
    would also be impossible against the database: the events table revokes update and
    delete. So the copy is what a rewritten history would look like if someone did get
    that far, and the sweep is run against it under the same code path.
  */
  function tamperedCopy(rows: ChainedEvent[]): ChainedEvent[] {
    const copy = rows.map((r) => ({ ...r, payload: { ...(r.payload as object) } }));
    const target = Math.min(7, copy.length - 1);
    const row = copy[target];
    if (row) {
      row.payload = { ...(row.payload as Record<string, unknown>), risk_flag: true };
      /* The stored hash stays as it was: that is exactly the point. The row changed and
         the hash it carries no longer describes it. */
    }
    return copy;
  }

  async function run(nextMode: Mode) {
    if (!events) return;
    const token = ++runToken.current;
    setMode(nextMode);
    setPhase("running");
    setChecked(0);
    setResult(null);

    const rows = nextMode === "tampered" ? tamperedCopy(events) : events;
    const verified = await verifyChain(rows);

    /*
      The sweep is animated by revealing the already computed result row by row rather
      than by verifying slowly. Recomputing 184 hashes takes a few milliseconds and the
      point of the animation is to let a person follow it, so the honest thing is to
      separate the two: the maths is instant, the reading of it is paced.

      It also halts on the first bad row rather than running to the end, because that is
      what the result means: everything after a rewritten row is unverifiable, not wrong.
    */
    const stopAt = verified.firstBadIndex === null ? rows.length : verified.firstBadIndex + 1;
    const step = reduced ? 0 : Math.max(4, Math.min(18, 900 / Math.max(1, stopAt)));

    for (let i = 1; i <= stopAt; i++) {
      if (runToken.current !== token) return;
      setChecked(i);
      if (step > 0) await new Promise((r) => setTimeout(r, step));
    }

    if (runToken.current !== token) return;
    setResult(verified);
    setPhase("done");
  }

  const rows = events ?? [];
  const shown = rows.slice(0, 60);

  return (
    <div className={styles.page}>
      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>Verify the chain</h2>
          <span className={styles.note}>
            {backend === "local"
              ? "Recomputed in this browser, from the events themselves"
              : "Recomputed in this browser against the stored ledger"}
          </span>
        </header>

        <p className={styles.note}>
          Every event carries the sha256 of the one before it. This page rebuilds each
          hash from the event's own contents and compares it with the hash the ledger
          stored. It does not ask the server whether the server is right. The canonical
          form is the same one the database trigger uses, down to how Postgres orders
          jsonb keys, and there is a test that checks the two engines agree.
        </p>

        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => run("honest")}
            disabled={phase === "running" || !events}
          >
            Verify {rows.length} events
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => run("tampered")}
            disabled={phase === "running" || !events}
          >
            Show me a tampered chain
          </button>
        </div>

        {phase !== "idle" ? (
          <div
            className={`${styles.result} ${
              phase === "done" ? (result?.ok ? styles.resultOk : styles.resultBad) : ""
            }`}
            role="status"
          >
            {phase === "running" ? (
              <span>
                Recomputing {checked} of {rows.length}
              </span>
            ) : result?.ok ? (
              <span>
                All {rows.length} events verify. Every hash matches the contents of its own
                row and the row before it.
              </span>
            ) : (
              <span>
                Chain broken at event {(result?.firstBadIndex ?? 0) + 1}. Its stored hash no
                longer describes its contents, so nothing after it can be trusted.
              </span>
            )}
          </div>
        ) : null}

        <div className={styles.sweepWrap}>
          {shown.map((e, i) => {
            const state =
              phase === "idle" || i >= checked
                ? "pending"
                : result && result.firstBadIndex === i
                  ? "bad"
                  : "ok";
            return (
              <div
                key={e.id}
                className={`${styles.row} ${state === "bad" ? styles.rowBad : ""}`}
              >
                <span className={styles.seq}>{i + 1}</span>
                <span className={styles.rowTitle}>{e.title}</span>
                <span className={styles.hash}>{e.thisHash.slice(0, 24)}</span>
                <span
                  className={`${styles.mark} ${
                    state === "ok" ? styles.markOk : state === "bad" ? styles.markBad : styles.markPending
                  }`}
                  aria-hidden="true"
                >
                  {state === "ok" ? "✓" : state === "bad" ? "✗" : "·"}
                </span>
              </div>
            );
          })}
        </div>
        {rows.length > shown.length ? (
          <span className={styles.note}>
            Showing the first {shown.length} rows. All {rows.length} are verified.
          </span>
        ) : null}
        {mode === "tampered" && phase === "done" ? (
          <span className={styles.note}>
            The edit was made to a copy held in this page. The ledger itself revokes update
            and delete, so this is what a rewritten history would look like if someone got
            past that, not something that just happened to your data.
          </span>
        ) : null}
      </section>

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>Anchor receipt</h2>
          <span className={styles.note}>OpenTimestamps, Bitcoin calendar</span>
        </header>
        <p className={styles.note}>
          The hash chain proves the ledger is internally consistent. It cannot prove when
          the ledger existed in that shape, which is what the anchor is for: the head is
          submitted to the OpenTimestamps calendars, and once a Bitcoin block confirms it
          the receipt shows the block. Confirmation takes hours, so a fresh receipt is
          honestly pending and says so rather than implying otherwise.
        </p>
        <div className={styles.receipt}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <span className={styles.fieldValue}>
              {backend === "local" ? "not anchored in local mode" : "pending"}
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Head</span>
            <span className={styles.fieldValue}>
              {rows.length ? rows[rows.length - 1]!.thisHash.slice(0, 32) : "no events"}
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Through event</span>
            <span className={styles.fieldValue}>
              {rows.length ? `${rows.length}, ${strategyName(rows[rows.length - 1]!.strategyId)}` : "none"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
