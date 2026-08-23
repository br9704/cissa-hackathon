import { useMemo, useState } from "react";
import styles from "./AcademyPage.module.css";
import { buildCurriculum } from "./curriculum";
import { corpus } from "../data/source";
import { DecisionLink, QuestionLink, StrategyLink } from "../components/EntityLink";
import { StatusChip } from "../components/StatusChip";

/*
  The Academy.

  The first problem this product solves is that reasoning leaves with the person. The second,
  which is the larger one, is that a desk losing a portfolio manager loses value on the day,
  and the answer to that is not retention. It is that the firm's own record of how its people
  think becomes what trains the next ones, updated continuously by the people currently doing
  the work rather than written once by somebody on their notice period.

  Everything on this page is derived. The modules are the books, the lessons are the decisions
  actually recorded, the order comes from the genealogy, and the syllabus is the set of
  questions nobody has answered. Nothing is authored, which is the same rule the rest of the
  product follows and the reason this can never go stale: it IS the ledger, arranged for
  somebody who was not there.

  Assessment compares an answer against what the desk wrote down. It does not grade a person,
  and it never will: the moment a training surface ranks people it becomes a performance tool,
  everybody learns to game it, and the record stops being honest.
*/
export function AcademyPage() {
  const c = corpus();
  const modules = useMemo(() => buildCurriculum(c), [c]);
  const [activeId, setActiveId] = useState(modules[0]?.strategyId ?? "");
  const active = modules.find((m) => m.strategyId === activeId) ?? modules[0];

  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [lessonIndex, setLessonIndex] = useState(0);

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const totalGaps = modules.reduce((n, m) => n + m.gaps, 0);

  if (!active) return null;

  const quizLesson = active.lessons[lessonIndex % Math.max(1, active.lessons.length)];

  function nextQuestion() {
    setRevealed(false);
    setAnswer("");
    setLessonIndex((i) => i + 1);
  }

  return (
    <div className={styles.page}>
      <h1>Academy</h1>
      <p className={styles.lede}>
        The desk's own record, arranged for somebody who was not there. Modules are books,
        lessons are the decisions actually recorded on them, and the order follows what
        replaced what, because a change only makes sense after the thing it replaced. Nothing
        here is written for training: it is the ledger, which is why it cannot go stale.
      </p>

      <div className={styles.grid}>
        <div>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Where the record is thinnest</span>
            </div>
            <p className={styles.empty}>
              {totalLessons} recorded decisions across {modules.length} books.{" "}
              <span className={styles.orphanRiskValue}>{totalGaps}</span> sit on books where
              every person who wrote on them has gone, so those are taught first.
              {totalGaps === 0 ? (
                <>
                  {" "}
                  That count is zero today, and it is the strict test on purpose: a book still
                  has somebody who can answer for it as long as one of its authors is here.
                  Knowledge risk uses the looser measure, which is why its number is larger.
                </>
              ) : null}
            </p>
          </div>

          <div className={styles.modules}>
            {modules.map((m) => (
              <button
                key={m.strategyId}
                type="button"
                className={styles.module}
                data-active={m.strategyId === active.strategyId}
                onClick={() => {
                  setActiveId(m.strategyId);
                  setLessonIndex(0);
                  setRevealed(false);
                  setAnswer("");
                }}
              >
                <span className={styles.moduleName}>{m.name}</span>
                <span className={styles.moduleMeta}>
                  <span>{m.lessons.length} lessons</span>
                  <span>{m.openQuestions.length} open questions</span>
                  {m.gaps > 0 ? <span className={styles.orphanRiskValue}>{m.gaps} unexplained</span> : null}
                </span>
                <span className={styles.bar}>
                  <span
                    className={styles.barFill}
                    data-risk={m.coverage < 0.5}
                    style={{ width: `${Math.round(m.coverage * 100)}%` }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                <StrategyLink id={active.strategyId}>{active.name}</StrategyLink>
              </span>
              <span className={styles.panelHint}>{active.description}</span>
            </div>

            {active.openQuestions.length > 0 ? (
              <>
                <p className={styles.empty}>
                  Start here. These are the questions the record does not answer, which means
                  the answers exist only in somebody's head. Ask them out loud while you still
                  can.
                </p>
                {active.openQuestions.map((q) => (
                  <p key={q.id} className={styles.riskQuestion}>
                    <QuestionLink id={q.id}>{q.text}</QuestionLink>
                  </p>
                ))}
              </>
            ) : (
              <p className={styles.empty}>
                Every question asked about this book has a recorded answer, which is the
                outcome this whole product is trying to produce.
              </p>
            )}
          </div>

          {quizLesson ? (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Can you explain this one</span>
                <span className={styles.panelHint}>
                  compared against what the desk wrote, never scored
                </span>
              </div>
              <div className={styles.assess}>
                <p className={styles.prompt}>
                  Why is <strong>{quizLesson.title.toLowerCase()}</strong> the way it is?
                </p>
                <textarea
                  className={styles.answer}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="In your own words. Nothing is stored and nothing is marked."
                  aria-label="Your explanation"
                />
                <div className={styles.row}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => setRevealed(true)}
                    disabled={!answer.trim() && !revealed}
                  >
                    Compare with the record
                  </button>
                  <button type="button" className={styles.secondary} onClick={nextQuestion}>
                    Another
                  </button>
                  {quizLesson.authorGone ? (
                    <StatusChip variant="risk">the author has left</StatusChip>
                  ) : null}
                </div>

                {revealed ? (
                  <div className={styles.recorded}>
                    <span className={styles.recordedLabel}>What the desk recorded</span>
                    {quizLesson.why}
                    <p className={styles.lessonWho}>
                      {quizLesson.authorName}
                      {quizLesson.authorGone ? (
                        <span className={styles.lessonGone}>, who has since left</span>
                      ) : null}
                      {" · "}
                      <DecisionLink id={quizLesson.decisionId}>read the full record</DecisionLink>
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>The book, in the order it happened</span>
              <span className={styles.panelHint}>{active.lessons.length} lessons</span>
            </div>
            {active.lessons.slice(0, 25).map((l, i) => (
              <div key={l.decisionId} className={styles.lesson}>
                <span className={styles.lessonIndex}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.lessonBody}>
                  <span className={styles.lessonTitle}>
                    <DecisionLink id={l.decisionId}>{l.title}</DecisionLink>
                  </span>
                  <span className={styles.lessonWhy}>{l.why}</span>
                  <span className={styles.lessonWho}>
                    {l.authorName}
                    {l.orphaned ? (
                      <span className={styles.lessonGone}> · nobody left can explain this</span>
                    ) : null}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
