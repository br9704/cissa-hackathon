import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./LedgerPage.module.css";
import { LedgerRail } from "../components/LedgerRail";
import { DecisionCard } from "../components/DecisionCard";
import { corpus, type LedgerEntry } from "../data/source";
import { useLiveLedger } from "../data/live";

/*
  The connection state is shown, not hidden. A tail that has silently dropped looks
  exactly like a quiet afternoon, and those are very different things.
*/
const CONNECTION_LABEL: Record<string, string> = {
  local: "Local corpus, the same one the seed loads",
  connecting: "Connecting to the live tail",
  live: "Live tail, pushed from the ledger",
  dropped: "Live tail dropped, showing the last load",
};

export function LedgerPage() {
  const { entries, connection, freshId } = useLiveLedger();
  const c = corpus();
  const reduced = useReducedMotion();

  /* Ids the viewer has acted on this session, and which one just landed. */
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [justApproved, setJustApproved] = useState<string | null>(null);

  const queue = useMemo(
    () =>
      c.decisions
        .filter((d) => d.approvedAt === null && !resolved.has(d.id))
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [c.decisions, resolved],
  );

  const resolve = useCallback((id: string, approved: boolean) => {
    setResolved((prev) => new Set(prev).add(id));
    if (approved) {
      setJustApproved(id);
      /* Clear the landing pill once the flight has settled, so the rail is not left with
         a decoration nobody asked for. */
      window.setTimeout(() => setJustApproved(null), 900);
    }
  }, []);

  const shown = useMemo<LedgerEntry[]>(() => {
    const approvedNow = new Set([...resolved].filter((id) => id === justApproved));
    return entries.map((e) =>
      approvedNow.has(e.id) ? { ...e, draft: false } : e,
    );
  }, [entries, resolved, justApproved]);

  const drafts = queue.length;
  const risk = entries.filter((e) => e.riskFlag).length;

  return (
    <div className={styles.page}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{entries.length}</span>
          <span className={styles.statLabel}>Events on the chain</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{c.artifacts.length}</span>
          <span className={styles.statLabel}>Captured artifacts</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{risk}</span>
          <span className={styles.statLabel}>Risk flagged decisions</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{drafts}</span>
          <span className={styles.statLabel}>Awaiting approval</span>
        </div>
      </div>

      <div className={styles.queue}>
        <div className={styles.queueHead}>
          <span className={styles.queueTitle}>
            {drafts > 0 ? `${drafts} awaiting approval` : "Nothing awaiting approval"}
          </span>
          <span className={styles.queueNote}>
            A model wrote the record. A person decides whether it is true.
          </span>
        </div>

        {/*
          One AnimatePresence around the queue AND the landing slot below the rail header.
          The approve transition is a shared layoutId handing the card off to the pill it
          becomes, and that only works if both ends are inside the same presence tree.
        */}
        <AnimatePresence mode="popLayout" initial={false}>
          {queue.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.queueEmpty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              The queue is empty. It fills itself: a commit that touches strategy code
              files an artifact, and a decision record is drafted against it for approval.
            </motion.div>
          ) : (
            queue.slice(0, 1).map((d) => (
              <DecisionCard
                key={d.id}
                decision={d}
                active
                layoutId={`draft-${d.id}`}
                onApprove={() => resolve(d.id, true)}
                onReject={() => resolve(d.id, false)}
              />
            ))
          )}
        </AnimatePresence>

        <div className={styles.landing}>
          <AnimatePresence>
            {justApproved ? (
              <motion.span
                key={justApproved}
                className={styles.pillWrap}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                Filed to the ledger, chained
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <section className={styles.railPane}>
        <header className={styles.railHeader}>
          <h2 className={styles.railTitle}>Ledger</h2>
          <span className={styles.railNote}>{CONNECTION_LABEL[connection]}</span>
        </header>
        <LedgerRail entries={shown} freshId={justApproved ?? freshId} />
      </section>
    </div>
  );
}
