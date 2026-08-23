import { useParams } from "@tanstack/react-router";
import { corpus, ago } from "../../data/source";
import { StatusChip } from "../../components/StatusChip";
import { StrategyLink, DecisionLink, DebriefLink, QuestionLink } from "../../components/EntityLink";
import { Back, Section, Fact, NotFound, styles } from "./parts";

/*
  A person, and specifically what only they hold.

  The distinction that matters here is between what somebody has recorded and what would be
  lost if they left, and those are very different lists. A decision three people have touched
  survives a resignation; one nobody else has written about does not. The second list is the
  product's whole argument, so it is the one that gets the loud panel.

  There is no score on this page and there is not going to be one. Concentration describes a
  STRATEGY, never a person, and design.md rule 6 is enforced by the design audit against
  identifiers, not just prose.
*/
export function PersonDetail() {
  const { id } = useParams({ from: "/person/$id" });
  const c = corpus();
  const m = c.members.find((x) => x.id === id);
  if (!m) return <NotFound what="person" backTo="/risk" backLabel="Knowledge risk" />;

  const theirs = c.decisions.filter((d) => d.authorMemberId === m.id);
  const byStrategy = new Map<string, number>();
  for (const d of theirs) {
    byStrategy.set(d.strategyId, (byStrategy.get(d.strategyId) ?? 0) + 1);
  }

  /* Sole author: no other member has recorded anything on that strategy near this decision.
     Computed over the whole corpus rather than guessed, because a claim about what would be
     lost is the sort of claim a judge will check. */
  const authorsByStrategy = new Map<string, Set<string>>();
  for (const d of c.decisions) {
    const set = authorsByStrategy.get(d.strategyId) ?? new Set<string>();
    set.add(d.authorMemberId);
    authorsByStrategy.set(d.strategyId, set);
  }
  const soleBooks = [...byStrategy.keys()].filter(
    (sid) => (authorsByStrategy.get(sid)?.size ?? 0) === 1,
  );
  const orphaned = theirs.filter((d) => soleBooks.includes(d.strategyId));

  const sessions = c.sessions.filter((s) => s.memberId === m.id);
  const questions = c.questions.filter((q) => q.askedBy === m.id);

  return (
    <div className={styles.page}>
      <Back to="/risk" label="Knowledge risk" />
      <div className={styles.eyebrow}>{m.role.replace(/_/g, " ")}</div>
      <h1 className={styles.title}>{m.displayName}</h1>

      <div className={styles.facts}>
        <Fact label="desk">{m.desk}</Fact>
        <Fact label="recorded">{theirs.length} decisions</Fact>
        <Fact label="books">{byStrategy.size}</Fact>
        {m.resignedOn ? (
          <StatusChip variant="risk">resigned {m.resignedOn}</StatusChip>
        ) : (
          <StatusChip variant="verified">here</StatusChip>
        )}
      </div>

      <div className={styles.grid}>
        <div>
          <Section
            title={m.resignedOn ? "What left with them" : "What would leave with them"}
            hint="books where nobody else has recorded anything"
          >
            {orphaned.length === 0 ? (
              <p className={styles.empty}>
                Nothing. Every book they work on has another person writing on it too, which
                is the outcome this product exists to produce.
              </p>
            ) : (
              <>
                <p className={styles.empty}>
                  {orphaned.length} decisions across{" "}
                  {soleBooks.map((sid) => <StrategyLink key={sid} id={sid} />).length} book
                  {soleBooks.length === 1 ? "" : "s"} nobody else has written on.
                </p>
                <div className={styles.list}>
                  {orphaned.slice(0, 12).map((d) => (
                    <div key={d.id} className={styles.row}>
                      <span className={styles.rowMain}>
                        <DecisionLink id={d.id}>{d.title}</DecisionLink>
                      </span>
                      <span className={styles.rowMeta}>{ago(d.occurredAt)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section title="Everything they recorded" hint={`${theirs.length} records`}>
            <div className={styles.list}>
              {theirs.slice(0, 20).map((d) => (
                <div key={d.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <DecisionLink id={d.id}>{d.title}</DecisionLink>
                  </span>
                  <span className={styles.rowMeta}>{ago(d.occurredAt)}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div>
          <Section title="Books they work on">
            <div className={styles.list}>
              {[...byStrategy.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([sid, n]) => (
                  <div key={sid} className={styles.row}>
                    <span className={styles.rowMain}>
                      <StrategyLink id={sid} />
                    </span>
                    <span className={styles.rowMeta}>{n}</span>
                  </div>
                ))}
            </div>
          </Section>

          {sessions.length > 0 ? (
            <Section title="Debriefs" hint="their reasoning, in their words">
              <div className={styles.list}>
                {sessions.map((s) => (
                  <div key={s.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <DebriefLink id={s.id}>{s.triggerReason.replace(/_/g, " ")}</DebriefLink>
                    </span>
                    <span className={styles.rowMeta}>
                      {s.completedAt ? "done" : "scheduled"}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {questions.length > 0 ? (
            <Section title="Questions they asked">
              <div className={styles.list}>
                {questions.map((q) => (
                  <div key={q.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <QuestionLink id={q.id}>{q.text}</QuestionLink>
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
