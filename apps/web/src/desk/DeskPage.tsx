import { useMemo, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import styles from "./DeskPage.module.css";
import {
  SECTIONS,
  ROLE_LABEL,
  ROLE_LEDE,
  viewerId,
  viewerRole,
  setViewer,
  subscribeToViewer,
  type DeskSection,
} from "./viewer";
import { corpus, ago, memberName } from "../data/source";
import { buildCurriculum } from "../academy/curriculum";
import { DecisionLink, PersonLink, StrategyLink, QuestionLink } from "../components/EntityLink";
import { StatusChip } from "../components/StatusChip";
import { PageHeader } from "../components/PageHeader";

/*
  The Desk: what somebody opens in the morning.

  The same ledger arranged by who is looking. A desk head opens on what is waiting for them
  and what the desk would lose; a researcher on what nobody has answered about the books they
  touch; compliance on whether the chain still holds and what a model wrote that no person
  approved; somebody new on the curriculum, because their first month IS the training
  programme.

  That last one is how the second problem stops being a separate product.
*/
export function DeskPage() {
  useSyncExternalStore(subscribeToViewer, viewerId, () => null);
  const role = viewerRole();
  const c = corpus();

  const modules = useMemo(() => buildCurriculum(c), [c]);
  const me = c.members.find((m) => m.id === viewerId());

  const drafts = c.decisions.filter((d) => d.draftedBy === "model" && !d.approvedAt);
  const gone = new Set(c.members.filter((m) => m.resignedOn).map((m) => m.id));
  const orphaned = c.decisions.filter((d) => gone.has(d.authorMemberId));
  const openQuestions = c.questions.filter((q) => !q.answeredByDecisionId);
  const mine = me ? c.decisions.filter((d) => d.authorMemberId === me.id) : [];
  const myBooks = new Set(mine.map((d) => d.strategyId));
  const recent = [...c.decisions]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .filter((d) => (myBooks.size === 0 ? true : myBooks.has(d.strategyId)))
    .slice(0, 8);

  function panel(section: DeskSection) {
    switch (section) {
      case "approvals":
        return (
          <div key={section} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Waiting for a person</span>
              <span className={styles.panelHint}>a model wrote these, nobody has read them</span>
            </div>
            <div className={`${styles.big} ${drafts.length ? "" : styles.bigOk}`}>
              {drafts.length}
            </div>
            <p className={styles.empty}>
              {drafts.length === 0
                ? "Nothing is waiting. Every record in the ledger has been read by somebody."
                : "Ten seconds each. That keystroke is what separates a record you can rely on from text a machine generated."}
            </p>
            {drafts.slice(0, 5).map((d) => (
              <div key={d.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <DecisionLink id={d.id}>{d.title}</DecisionLink>
                </span>
                <span className={styles.rowMeta}>
                  <StrategyLink id={d.strategyId} />
                </span>
              </div>
            ))}
          </div>
        );

      case "exposure":
        return (
          <div key={section} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>What the desk would lose</span>
              <span className={styles.panelHint}>counted per record, never per person</span>
            </div>
            <div className={styles.stats}>
              <span className={styles.stat}>
                <span className={`${styles.big} ${orphaned.length ? styles.bigRisk : styles.bigOk}`}>
                  {orphaned.length}
                </span>
                <span className={styles.statLabel}>records whose author has left</span>
              </span>
              <span className={styles.stat}>
                <span className={styles.big}>{openQuestions.length}</span>
                <span className={styles.statLabel}>questions with no recorded answer</span>
              </span>
              <span className={styles.stat}>
                <span className={styles.big}>{c.decisions.length}</span>
                <span className={styles.statLabel}>decisions on the record</span>
              </span>
            </div>
            <p className={styles.empty}>
              <Link to="/risk">See which books, and what a resignation would do to them.</Link>
            </p>
          </div>
        );

      case "my_open_questions":
        return (
          <div key={section} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                {me ? "Unanswered on your books" : "Unanswered across the desk"}
              </span>
              <span className={styles.panelHint}>the reasoning that is not written down yet</span>
            </div>
            {openQuestions.length === 0 ? (
              <p className={styles.empty}>Everything asked has a recorded answer.</p>
            ) : (
              openQuestions
                .filter((q) => (myBooks.size === 0 ? true : myBooks.has(q.strategyId)))
                .slice(0, 6)
                .map((q) => (
                  <div key={q.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <QuestionLink id={q.id}>{q.text}</QuestionLink>
                    </span>
                    <span className={styles.rowMeta}>
                      <StrategyLink id={q.strategyId} />
                    </span>
                  </div>
                ))
            )}
          </div>
        );

      case "recent_on_my_books":
        return (
          <div key={section} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                {myBooks.size ? "Recently, on your books" : "Recently, across the desk"}
              </span>
              <span className={styles.panelHint}>newest first</span>
            </div>
            {recent.map((d) => (
              <div key={d.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <DecisionLink id={d.id}>{d.title}</DecisionLink>
                </span>
                <span className={styles.rowMeta}>
                  <PersonLink id={d.authorMemberId} /> · {ago(d.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        );

      case "chain_state":
        return (
          <div key={section} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>The record itself</span>
              <span className={styles.panelHint}>every row sealed to the one before it</span>
            </div>
            <div className={styles.stats}>
              <span className={styles.stat}>
                <span className={styles.big}>{c.decisions.length}</span>
                <span className={styles.statLabel}>events in the chain</span>
              </span>
              <span className={styles.stat}>
                <span className={styles.big}>{c.artifacts.length}</span>
                <span className={styles.statLabel}>artifacts referenced</span>
              </span>
            </div>
            <p className={styles.empty}>
              <Link to="/verify">Recompute every seal, and try to alter one.</Link>
            </p>
          </div>
        );

      case "unapproved_drafts":
        return (
          <div key={section} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Written by a model, unread by a person</span>
              <span className={styles.panelHint}>the population that needs an approver</span>
            </div>
            <div className={`${styles.big} ${drafts.length ? styles.bigRisk : styles.bigOk}`}>
              {drafts.length}
            </div>
            <p className={styles.empty}>
              A record nobody approved is not evidence of anything, which is the distinction
              this whole schema exists to hold.
            </p>
          </div>
        );

      case "curriculum":
        return (
          <div key={section} className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Start here</span>
              <span className={styles.panelHint}>the record, arranged for somebody new</span>
            </div>
            {modules.slice(0, 3).map((m) => (
              <div key={m.strategyId} className={styles.row}>
                <span className={styles.rowMain}>
                  <StrategyLink id={m.strategyId}>{m.name}</StrategyLink>
                </span>
                <span className={styles.rowMeta}>
                  {m.lessons.length} lessons · {m.openQuestions.length} open questions
                </span>
              </div>
            ))}
            <p className={styles.empty}>
              <Link to="/academy">Open the Academy.</Link>
            </p>
          </div>
        );
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <PageHeader title="Desk" lead={ROLE_LEDE[role]} />
        <span className={styles.spacer} />
        <label className={styles.who}>
          viewing as
          <select
            className={styles.select}
            value={viewerId() ?? ""}
            onChange={(e) => setViewer(e.target.value || null)}
            aria-label="Viewing as"
          >
            <option value="">somebody new</option>
            {c.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName} ({m.role.replace(/_/g, " ")})
              </option>
            ))}
          </select>
          <StatusChip>{ROLE_LABEL[role]}</StatusChip>
        </label>
      </div>

      <div className={styles.sections}>{SECTIONS[role].map(panel)}</div>

      {me?.resignedOn ? (
        <p className={styles.empty}>
          {memberName(me.id)} left on {me.resignedOn}. This is what the desk still holds from
          them.
        </p>
      ) : null}
    </div>
  );
}
