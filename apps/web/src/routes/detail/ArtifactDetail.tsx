import { useParams } from "@tanstack/react-router";
import { corpus, ago } from "../../data/source";
import { StatusChip } from "../../components/StatusChip";
import { PersonLink, StrategyLink, DecisionLink } from "../../components/EntityLink";
import { Back, Section, Fact, NotFound, styles } from "./parts";

/*
  A commit, a notebook, a parameter file or a meeting transcript.

  The useful direction here is backwards: given a piece of evidence, which recorded decisions
  cite it. That is the question an auditor asks and the one the app could not answer, because
  an artifact reference was previously plain text.
*/
export function ArtifactDetail() {
  const { id } = useParams({ from: "/artifact/$id" });
  const c = corpus();
  const a = c.artifacts.find((x) => x.id === id);
  if (!a) return <NotFound what="artifact" backTo="/" backLabel="The record" />;

  const citedBy = c.decisions.filter((d) => d.sourceArtifactIds.includes(a.id));

  return (
    <div className={styles.page}>
      <Back to="/" label="The record" />
      <div className={styles.eyebrow}>{a.kind.replace(/_/g, " ")}</div>
      <h1 className={`${styles.title} ${styles.titleWide}`}>{a.externalRef ?? a.id}</h1>

      <div className={styles.facts}>
        <Fact label="by">
          <PersonLink id={a.authorMemberId} />
        </Fact>
        <Fact label="on">
          <StrategyLink id={a.strategyId} />
        </Fact>
        <Fact label="when">{a.occurredAt.slice(0, 10)}</Fact>
        <StatusChip>{citedBy.length} citing decisions</StatusChip>
      </div>

      <div className={styles.grid}>
        <div>
          <Section
            title="Decisions written from this"
            hint="the audit direction: evidence to record"
          >
            {citedBy.length === 0 ? (
              <p className={styles.empty}>
                Nothing cites this yet. Captured, but the reasoning behind it has not been
                written down, which is exactly the gap this product measures.
              </p>
            ) : (
              <div className={styles.list}>
                {citedBy.map((d) => (
                  <div key={d.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <DecisionLink id={d.id}>{d.title}</DecisionLink>
                    </span>
                    <span className={styles.rowMeta}>{ago(d.occurredAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
        <div>
          <Section title="Content hash">
            <p className={styles.hash}>{a.contentHash}</p>
            <p className={styles.empty}>
              What the record points at. If the underlying file changed, this would not match
              it any more.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
