import { useParams } from "@tanstack/react-router";
import { corpus, ago } from "../../data/source";
import { StatusChip } from "../../components/StatusChip";
import { PersonLink, StrategyLink, DecisionLink } from "../../components/EntityLink";
import { Back, Section, Fact, NotFound, styles } from "./parts";

/*
  An open question.

  These are the most valuable rows in the corpus and the easiest to overlook: a question
  nobody has answered is a piece of the desk's reasoning that exists only in somebody's head.
  They are also, unchanged, the syllabus for the training programme, which is why this page
  shows who could plausibly answer it rather than just stating that nobody has.
*/
export function QuestionDetail() {
  const { id } = useParams({ from: "/question/$id" });
  const c = corpus();
  const q = c.questions.find((x) => x.id === id);
  if (!q) return <NotFound what="question" backTo="/risk" backLabel="Knowledge risk" />;

  const answer = q.answeredByDecisionId
    ? c.decisions.find((d) => d.id === q.answeredByDecisionId)
    : null;

  /* Who could answer: whoever has actually written on this book, most prolific first. This
     is a suggestion drawn from the record, not a judgement about people. */
  const authors = new Map<string, number>();
  for (const d of c.decisions.filter((d) => d.strategyId === q.strategyId)) {
    authors.set(d.authorMemberId, (authors.get(d.authorMemberId) ?? 0) + 1);
  }
  const related = c.decisions
    .filter((d) => d.strategyId === q.strategyId)
    .slice(0, 8);

  return (
    <div className={styles.page}>
      <Back to="/risk" label="Knowledge risk" />
      <div className={styles.eyebrow}>Open question</div>
      <h1 className={`${styles.title} ${styles.titleWide}`}>{q.text}</h1>

      <div className={styles.facts}>
        <Fact label="about">
          <StrategyLink id={q.strategyId} />
        </Fact>
        <Fact label="asked by">
          <PersonLink id={q.askedBy} />
        </Fact>
        {answer ? (
          <StatusChip variant="verified">answered</StatusChip>
        ) : (
          <StatusChip variant="risk">no recorded answer</StatusChip>
        )}
      </div>

      <div className={styles.grid}>
        <div>
          <Section title="The answer">
            {answer ? (
              <>
                <p className={styles.body}>{answer.why}</p>
                <p className={styles.empty}>
                  Recorded in <DecisionLink id={answer.id}>{answer.title}</DecisionLink>.
                </p>
              </>
            ) : (
              <p className={styles.empty}>
                Nothing in the record answers this. Whatever the answer is, it currently
                exists only in somebody's head, which is precisely what this system is for.
              </p>
            )}
          </Section>

          <Section title="Related records on this book">
            <div className={styles.list}>
              {related.map((d) => (
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
          <Section title="Who could answer it" hint="from who has written on this book">
            <div className={styles.list}>
              {[...authors.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([mid, n]) => (
                  <div key={mid} className={styles.row}>
                    <span className={styles.rowMain}>
                      <PersonLink id={mid} />
                    </span>
                    <span className={styles.rowMeta}>{n} records here</span>
                  </div>
                ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
