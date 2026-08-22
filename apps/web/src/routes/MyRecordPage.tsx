import { useMemo, useState, useSyncExternalStore } from "react";
import styles from "./MyRecordPage.module.css";
import { PageHeader } from "../components/PageHeader";
import { StatusChip } from "../components/StatusChip";
import { corpus, memberInitials, memberName, strategyName, ago } from "../data/source";
import { accessLog, subscribeToAccessLog } from "../data/access";

/*
  My Record.

  Everything captured from one person, and everything anybody did with it.

  This screen is the acceptability condition for the rest of the product. Capture that is
  continuous and ambient is only defensible if the people it captures can see what it
  holds, and a promise in a contract is not the same thing as a screen. It is also the
  place the doctrine gets tested: if this view is uncomfortable to show somebody, the
  capture behind it was wrong, not the view.

  A member switcher sits here because the demo has no real sign in, and because it makes
  the point faster than an explanation: this is what YOUR record looks like, for any
  value of you.
*/
export function MyRecordPage() {
  const c = corpus();
  const [memberId, setMemberId] = useState(c.members[0]!.id);
  const member = c.members.find((m) => m.id === memberId)!;

  const log = useSyncExternalStore(subscribeToAccessLog, accessLog, accessLog);

  const mine = useMemo(() => {
    const decisions = c.decisions.filter((d) => d.authorMemberId === memberId);
    const artifacts = c.artifacts.filter((a) => a.authorMemberId === memberId);
    const sessions = c.sessions.filter((s) => s.memberId === memberId);
    const sessionIds = new Set(sessions.map((s) => s.id));
    const turns = c.turns.filter((t) => sessionIds.has(t.sessionId) && t.role === "human");
    return { decisions, artifacts, sessions, turns };
  }, [c, memberId]);

  const touching = log.filter((e) => e.subjectMemberIds.includes(memberId));

  return (
    <div className={styles.page}>
      <PageHeader
        title="My record"
        lead={
          "Everything this system has captured from you, and everyone who has looked at it. You do " +
          "not have to ask anybody for this page. That is the condition on which capturing anything" +
          " at all is reasonable."
        }
      />

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>You</h2>
          <span className={styles.note}>
            Everything captured from you, and everyone who has looked at it
          </span>
        </header>

        <div className={styles.identity}>
          <span className={styles.avatar}>{memberInitials(memberId)}</span>
          <span className={styles.who}>
            <span className={styles.whoName}>{member.displayName}</span>
            <span className={styles.whoDesk}>
              {member.desk} desk · {member.role.replace(/_/g, " ")}
            </span>
          </span>
          <span className={styles.switcher}>
            {c.members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.switch}
                data-active={m.id === memberId}
                onClick={() => setMemberId(m.id)}
              >
                {m.displayName.split(" ")[0]}
              </button>
            ))}
          </span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{mine.decisions.length}</span>
            <span className={styles.statLabel}>decisions you recorded</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{mine.artifacts.length}</span>
            <span className={styles.statLabel}>artifacts captured from your work</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{mine.turns.length}</span>
            <span className={styles.statLabel}>debrief answers you gave</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{touching.length}</span>
            <span className={styles.statLabel}>times somebody read or exported it</span>
          </div>
        </div>

        <p className={styles.doctrine}>
          Capture attaches to work product: commits, parameter files, transcripts,
          decisions. There is no screen recording, no keystroke or activity monitoring, no
          productivity analytics and no behavioural score, here or anywhere else in the
          product. Authorship is recorded because provenance is the thing that makes this
          record worth anything legally and operationally, and the analytics are
          de-personalised on purpose: risk is scored per strategy, never per person.
        </p>
      </section>

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>Who has looked</h2>
          <span className={styles.note}>Reads and exports are events on the same ledger</span>
        </header>
        {touching.length === 0 ? (
          <p className={styles.empty}>
            Nobody has read or exported anything of yours this session. When they do it
            appears here, with the reason they gave for an export, and you do not have to
            ask anybody for it.
          </p>
        ) : (
          <div className={styles.list}>
            {touching.map((e) => (
              <div className={styles.row} key={e.id}>
                <span className={styles.when}>{ago(e.at, Date.now())}</span>
                <span className={styles.what}>
                  {memberName(e.actorMemberId)}{" "}
                  {e.kind === "access_export" ? "exported" : "opened"} {e.target}
                  {e.justification ? (
                    <>
                      <br />
                      <span className={styles.sub}>Reason given: "{e.justification}"</span>
                    </>
                  ) : null}
                </span>
                <StatusChip variant={e.kind === "access_export" ? "risk" : "neutral"}>
                  {e.kind === "access_export" ? "export" : "read"}
                </StatusChip>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>What was captured</h2>
          <span className={styles.note}>Your most recent {Math.min(30, mine.decisions.length)} decisions</span>
        </header>
        <div className={styles.list}>
          {mine.decisions
            .slice()
            .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
            .slice(0, 30)
            .map((d) => (
              <div className={styles.row} key={d.id}>
                <span className={styles.when}>{ago(d.occurredAt)}</span>
                <span className={styles.what}>
                  {d.title}
                  <br />
                  <span className={styles.sub}>{strategyName(d.strategyId)}</span>
                </span>
                {d.riskFlag ? <StatusChip variant="risk">Risk</StatusChip> : <span />}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
