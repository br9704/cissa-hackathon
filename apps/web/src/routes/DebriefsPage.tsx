import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import styles from "./DebriefsPage.module.css";
import { StatusChip } from "../components/StatusChip";
import { corpus, memberInitials, memberName, strategyName } from "../data/source";
import { recall, type Recall } from "../search/recall";
import { promoteAnswer, promotedTurns, subscribeToPromotions } from "../data/promote";

const SUGGESTIONS = [
  "why is the expiry window capped",
  "what happens after two losing sessions",
  "why did the settlement source change",
  "what would you tell whoever takes this over",
];

const TRIGGER_LABEL: Record<string, string> = {
  post_merge: "after a merge",
  drawdown_flag: "after a drawdown flag",
  weekly_pulse: "weekly pulse",
  half_life_refresh: "memory half life refresh",
  exit: "exit debrief",
};

export function DebriefsPage() {
  const c = corpus();
  const reduced = useReducedMotion();

  /* Which answer is being promoted, and what has already been. */
  const [promoting, setPromoting] = useState<{ sessionId: string; seq: number } | null>(null);
  const [promoteTitle, setPromoteTitle] = useState("");
  const promoted = useSyncExternalStore(subscribeToPromotions, promotedTurns, promotedTurns);

  /* The person the demo turns on. If nobody has resigned this pane hides itself rather
     than inventing a departure. */
  const departed = c.members.find((m) => m.resignedOn) ?? null;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Recall | null>(null);
  const [busy, setBusy] = useState(false);
  const token = useRef(0);

  async function ask(q: string) {
    if (!departed || q.trim().length < 4) return;
    const mine = ++token.current;
    setBusy(true);
    setQuestion(q);
    try {
      const result = await recall(departed.id, q.trim());
      if (token.current !== mine) return;
      setAnswer(result);
    } finally {
      if (token.current === mine) setBusy(false);
    }
  }

  const goneFor = useMemo(() => {
    if (!departed?.resignedOn) return null;
    const days = Math.round(
      (Date.parse("2026-08-21T09:00:00Z") - Date.parse(departed.resignedOn)) / 86_400_000,
    );
    return days;
  }, [departed]);

  const sessions = useMemo(
    () =>
      c.sessions
        .slice()
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [c.sessions],
  );

  return (
    <div className={styles.page}>
      {departed ? (
        <section className={styles.pane}>
          <header className={styles.head}>
            <h2 className={styles.title}>Ask someone who has left</h2>
            <span className={styles.note}>Answered from their own record, word for word</span>
          </header>

          <div className={styles.recallHeader}>
            <span className={styles.avatarLarge}>{memberInitials(departed.id)}</span>
            <span className={styles.who}>
              <span className={styles.whoName}>{departed.displayName}</span>
              <span className={styles.whoGone}>
                Resigned{" "}
                {new Date(departed.resignedOn!).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {goneFor !== null ? `, ${goneFor} days ago` : ""}. He does not work here any more.
              </span>
            </span>
          </div>

          <div className={styles.askRow}>
            <input
              className={styles.askInput}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void ask(question);
              }}
              placeholder={`Ask ${departed.displayName.split(" ")[0]} something about his books`}
              aria-label="Ask a departed colleague"
            />
            <button
              type="button"
              className={styles.askButton}
              onClick={() => void ask(question)}
              disabled={busy || question.trim().length < 4}
            >
              {busy ? "Looking" : "Ask"}
            </button>
          </div>

          <div className={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.suggestion}
                onClick={() => void ask(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {answer ? (
              <motion.div
                key={answer.question}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {answer.silent ? (
                  <div className={styles.silent}>
                    {answer.memberName} never wrote anything about that.
                    <br />
                    <br />
                    That is the honest answer and it is worth as much as the others: it
                    names a gap that used to be invisible until somebody needed it and
                    found nobody left to ask.
                  </div>
                ) : (
                  <div className={styles.answer}>
                    {answer.lines.map((line, i) => (
                      <div className={styles.line} key={`${line.passageId}-${i}`}>
                        <p className={styles.quote}>{line.text}</p>
                        <span className={styles.cite}>
                          <span className={styles.citeChip}>
                            {line.source === "decision" ? "Decision" : "Debrief"}
                          </span>
                          <span className={styles.citeChip}>{line.title}</span>
                          <span className={styles.citeChip}>{line.strategyName}</span>
                        </span>
                      </div>
                    ))}
                    <p className={styles.provenance}>
                      These are {answer.memberName}'s own words, retrieved from the ledger
                      and quoted. Nothing here was written by a model or rephrased in his
                      voice: every line above is a sentence he typed, and every one of them
                      names the record it came from. The reason he can still answer is that
                      the reasoning was captured while he was here.
                    </p>
                  </div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      ) : null}

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>Debrief sessions</h2>
          <span className={styles.note}>
            Three to five questions, sixty seconds, every one grounded in something that
            actually happened
          </span>
        </header>

        <div className={styles.sessions}>
          {sessions.map((session) => {
            const turns = c.turns
              .filter((t) => t.sessionId === session.id)
              .sort((a, b) => a.seq - b.seq)
              .slice(0, 4);
            return (
              <div className={styles.session} key={session.id}>
                <div className={styles.sessionHead}>
                  <span className={styles.sessionName}>{memberName(session.memberId)}</span>
                  <span>{strategyName(session.strategyId)}</span>
                  <StatusChip variant={session.triggerReason === "exit" ? "risk" : "neutral"}>
                    {TRIGGER_LABEL[session.triggerReason] ?? session.triggerReason}
                  </StatusChip>
                </div>
                <div className={styles.turns}>
                  {turns.map((t) => (
                    <div className={styles.turn} key={t.seq}>
                      {t.role === "agent" ? (
                        <>
                          <span className={styles.turnAgent}>{t.text}</span>
                          {t.groundedArtifactIds.length ? (
                            <span className={styles.grounding}>
                              grounded in{" "}
                              {c.artifacts.find((a) => a.id === t.groundedArtifactIds[0])?.kind ===
                              "meeting_transcript"
                                ? "a recorded meeting"
                                : "a captured artifact"}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className={styles.turnRow}>
                            <span className={styles.turnHuman}>{t.text}</span>
                            {/*
                              Promoting an answer is the step that turns a conversation
                              into a record. It is a button rather than something the
                              agent does on its own, for the same reason approving a draft
                              is: the machine can propose that a sentence matters, and a
                              person decides whether it does.
                            */}
                            <button
                              type="button"
                              className={`${styles.promote} ${
                                promoted.has(`${t.sessionId}:${t.seq}`) ? styles.promoted : ""
                              }`}
                              disabled={promoted.has(`${t.sessionId}:${t.seq}`)}
                              onClick={() => {
                                setPromoting({ sessionId: t.sessionId, seq: t.seq });
                                setPromoteTitle(
                                  t.text.split(/(?<=[.!?])\s/)[0]?.slice(0, 80) ?? "",
                                );
                              }}
                            >
                              {promoted.has(`${t.sessionId}:${t.seq}`)
                                ? "filed as a decision"
                                : "promote to a decision"}
                            </button>
                          </span>

                          {promoting?.sessionId === t.sessionId && promoting.seq === t.seq ? (
                            <div className={styles.promoteForm}>
                              <span className={styles.promoteTitle}>
                                File this answer as a decision
                              </span>
                              <p className={styles.promoteBody}>
                                It will appear in the ledger as drafted by a model and
                                awaiting approval, with this debrief turn as its source. The
                                answer itself is not edited: the reasoning is what was said,
                                and only the title is written here.
                              </p>
                              <input
                                className={styles.promoteInput}
                                value={promoteTitle}
                                onChange={(e) => setPromoteTitle(e.target.value)}
                                aria-label="Title for the promoted decision"
                                autoFocus
                              />
                              <div className={styles.promoteActions}>
                                <button
                                  type="button"
                                  className={styles.promoteButton}
                                  disabled={promoteTitle.trim().length < 6}
                                  onClick={() => {
                                    promoteAnswer({
                                      sessionId: t.sessionId,
                                      seq: t.seq,
                                      title: promoteTitle.trim(),
                                      why: t.text,
                                      strategyId: session.strategyId,
                                      authorMemberId: session.memberId,
                                    });
                                    setPromoting(null);
                                  }}
                                >
                                  File it
                                </button>
                                <button
                                  type="button"
                                  className={styles.promoteCancel}
                                  onClick={() => setPromoting(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
