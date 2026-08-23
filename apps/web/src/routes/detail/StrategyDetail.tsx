import { useParams } from "@tanstack/react-router";
import { corpus, ago } from "../../data/source";
import { StatusChip } from "../../components/StatusChip";
import { PersonLink, DecisionLink, QuestionLink } from "../../components/EntityLink";
import { Back, Section, Fact, NotFound, styles } from "./parts";

/* A book: what it is, who has written on it, and what nobody has answered about it. */
export function StrategyDetail() {
  const { id } = useParams({ from: "/strategy/$id" });
  const c = corpus();
  const s = c.strategies.find((x) => x.id === id);
  if (!s) return <NotFound what="strategy" backTo="/strategies" backLabel="Strategies" />;

  const decisions = c.decisions.filter((d) => d.strategyId === s.id);
  const authors = new Map<string, number>();
  for (const d of decisions) authors.set(d.authorMemberId, (authors.get(d.authorMemberId) ?? 0) + 1);
  const questions = c.questions.filter((q) => q.strategyId === s.id);
  const unanswered = questions.filter((q) => !q.answeredByDecisionId);

  return (
    <div className={styles.page}>
      <Back to="/strategies" label="Strategies" />
      <div className={styles.eyebrow}>Book</div>
      <h1 className={styles.title}>{s.name}</h1>
      <p className={styles.lede}>{s.description}</p>

      <div className={styles.facts}>
        <StatusChip variant={s.status === "live" ? "verified" : "neutral"}>{s.status}</StatusChip>
        <Fact label="records">{decisions.length}</Fact>
        <Fact label="people who have written on it">{authors.size}</Fact>
        <Fact label="open questions">{unanswered.length}</Fact>
      </div>

      <div className={styles.grid}>
        <div>
          <Section title="Every decision on this book" hint={`${decisions.length} records`}>
            <div className={styles.list}>
              {decisions.slice(0, 30).map((d) => (
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
          </Section>
        </div>

        <div>
          <Section
            title="Who holds it"
            hint="counted per book, never scored per person"
          >
            <div className={styles.list}>
              {[...authors.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([mid, n]) => (
                  <div key={mid} className={styles.row}>
                    <span className={styles.rowMain}>
                      <PersonLink id={mid} />
                    </span>
                    <span className={styles.rowMeta}>{n} records</span>
                  </div>
                ))}
            </div>
            {authors.size === 1 ? (
              <p className={styles.empty}>
                One person has written everything on this book. That is what bus factor one
                means in practice.
              </p>
            ) : null}
          </Section>

          {unanswered.length > 0 ? (
            <Section title="Nobody has answered these" hint="the syllabus, in effect">
              <div className={styles.list}>
                {unanswered.map((q) => (
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
