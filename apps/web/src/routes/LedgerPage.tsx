import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./LedgerPage.module.css";
import { LedgerRail } from "../components/LedgerRail";
import { DecisionCard } from "../components/DecisionCard";
import { TranscriptImporter } from "../components/TranscriptImporter";
import { TaggerBadge } from "../components/TaggerBadge";
import { PageHeader } from "../components/PageHeader";
import { Section } from "../components/Section";
import { corpus, type LedgerEntry } from "../data/source";
import { useLiveLedger } from "../data/live";

/*
  The connection state is shown, not hidden. A tail that has silently dropped looks
  exactly like a quiet afternoon, and those are very different things.
*/
const CONNECTION_LABEL: Record<string, string> = {
  local: "Reading the local record",
  connecting: "Connecting",
  live: "Live, updating as decisions are filed",
  dropped: "Connection dropped, showing the last load",
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

  return (
    <div className={styles.page}>
      <PageHeader
        title="The record"
        lead={
          "Every decision this desk has made about how its strategies work, and the reasoning " +
          "behind it. Records are written automatically when someone commits code or files a " +
          "note, and nothing here can be edited or deleted once it is filed."
        }
        aside={CONNECTION_LABEL[connection]}
      />

      {/*
        What needs a person comes first.

        The previous version opened with four statistics, which is a summary of work
        already done, and buried the one thing on the page that was waiting on the reader.
        A screen should lead with what it is asking of you.
      */}
      <Section
        title={drafts > 0 ? "Waiting for you" : "Nothing waiting for you"}
        count={drafts > 0 ? drafts : undefined}
        lead={
          drafts > 0
            ? "A model wrote these from what actually changed. Read one, and press A if it is " +
              "right. That keystroke is the whole job: it takes about ten seconds and it is what " +
              "separates a record you can rely on from text a machine generated."
            : "Everything filed has been approved by a person."
        }
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {queue.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.queueEmpty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Nothing to approve. New records appear here on their own: a commit that touches
              strategy code files one automatically.
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
                Filed. It cannot be changed now.
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </Section>

      <Section
        title="Everything filed"
        count={`${entries.length} records`}
        lead={
          "Newest first. Each one is locked to the one before it, so if any of them were " +
          "altered later the Verify page would find it."
        }
      >
        <div className={styles.railPane}>
          <LedgerRail entries={shown} freshId={justApproved ?? freshId} />
        </div>
      </Section>

      {/*
        Secondary. These are things the desk sets up once, not things a reader acts on, so
        they sit below the record rather than between the reader and it.
      */}
      <Section
        title="How records get here"
        lead={
          "Nobody types these in. A commit that touches strategy code files one by itself, a " +
          "meeting transcript can be dropped in, and the category on each record is applied by " +
          "a model running on this machine."
        }
      >
        <TranscriptImporter />
        <TaggerBadge />
      </Section>
    </div>
  );
}
