import { useParams } from "@tanstack/react-router";
import { corpus, strategyName, TYPE_LABEL, ago } from "../../data/source";
import { StatusChip } from "../../components/StatusChip";
import { PersonLink, StrategyLink, DecisionLink, ArtifactLink } from "../../components/EntityLink";
import { Back, Section, Fact, NotFound, styles } from "./parts";

/*
  The decision record, in full.

  This is the page the whole product points at. Everywhere else shows a decision as a title
  in a row; this is where the reasoning, the alternatives that were rejected, the sources it
  was written from and its place in the lineage all sit together. Before it existed a ledger
  row went nowhere, which is why the app read as a list rather than as a record.
*/
export function DecisionDetail() {
  const { id } = useParams({ from: "/decision/$id" });
  const c = corpus();
  const d = c.decisions.find((x) => x.id === id);
  if (!d) return <NotFound what="decision" backTo="/" backLabel="The record" />;

  const parents = c.links.filter((l) => l.child === d.id);
  const children = c.links.filter((l) => l.parent === d.id);
  const sources = c.artifacts.filter((a) => d.sourceArtifactIds.includes(a.id));
  const byId = new Map(c.decisions.map((x) => [x.id, x]));
  const siblings = c.decisions
    .filter((x) => x.strategyId === d.strategyId && x.id !== d.id)
    .slice(0, 8);

  return (
    <div className={styles.page}>
      <Back to="/" label="The record" />
      <div className={styles.eyebrow}>Decision record</div>
      <h1 className={`${styles.title} ${styles.titleWide}`}>{d.title}</h1>

      <div className={styles.facts}>
        <Fact label="on">
          <StrategyLink id={d.strategyId} />
        </Fact>
        <Fact label="by">
          <PersonLink id={d.authorMemberId} />
        </Fact>
        <Fact label="recorded">{d.occurredAt.slice(0, 10)}</Fact>
        <Fact label="confidence">{d.confidence}</Fact>
        <StatusChip variant={d.draftedBy === "model" ? "neutral" : "verified"}>
          {d.draftedBy === "model" ? "drafted by model" : "written by a person"}
        </StatusChip>
        {d.riskFlag ? <StatusChip variant="risk">risk flagged</StatusChip> : null}
        <StatusChip>{TYPE_LABEL[d.decisionType] ?? d.decisionType}</StatusChip>
      </div>

      <div className={styles.grid}>
        <div>
          <Section title="What changed">
            <p className={styles.body}>{d.whatChanged}</p>
          </Section>

          <Section
            title="Why"
            hint="the part that leaves with the person"
          >
            <p className={styles.body}>{d.why}</p>
          </Section>

          {d.alternatives.length > 0 ? (
            <Section
              title="What was rejected"
              hint="half of why a record is worth keeping"
            >
              {d.alternatives.map((a) => (
                <p key={a} className={styles.alt}>
                  {a}
                </p>
              ))}
            </Section>
          ) : null}

          {siblings.length > 0 ? (
            <Section title={`Other decisions on ${strategyName(d.strategyId)}`}>
              <div className={styles.list}>
                {siblings.map((s) => (
                  <div key={s.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <DecisionLink id={s.id}>{s.title}</DecisionLink>
                    </span>
                    <span className={styles.rowMeta}>{ago(s.occurredAt)}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        <div>
          <Section title="Lineage" hint="what this replaced, and what replaced it">
            {parents.length === 0 && children.length === 0 ? (
              <p className={styles.empty}>
                Nothing in the record links to this one. It is either the first word on the
                subject or the reasoning behind it was never connected up.
              </p>
            ) : (
              <div className={styles.list}>
                {parents.map((l) => (
                  <div key={`p-${l.parent}`} className={styles.row}>
                    <span className={styles.rowMeta}>{l.relation.replace(/_/g, " ")}</span>
                    <span className={styles.rowMain}>
                      <DecisionLink id={l.parent}>
                        {byId.get(l.parent)?.title ?? l.parent}
                      </DecisionLink>
                    </span>
                  </div>
                ))}
                {children.map((l) => (
                  <div key={`c-${l.child}`} className={styles.row}>
                    <span className={styles.rowMeta}>led to</span>
                    <span className={styles.rowMain}>
                      <DecisionLink id={l.child}>
                        {byId.get(l.child)?.title ?? l.child}
                      </DecisionLink>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Written from" hint="the evidence behind the record">
            {sources.length === 0 ? (
              <p className={styles.empty}>Filed by hand, with no source artifact attached.</p>
            ) : (
              <div className={styles.list}>
                {sources.map((a) => (
                  <div key={a.id} className={styles.row}>
                    <span className={styles.rowMeta}>{a.kind.replace(/_/g, " ")}</span>
                    <span className={styles.rowMain}>
                      <ArtifactLink id={a.id}>{a.externalRef ?? a.id}</ArtifactLink>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="In the chain">
            <p className={styles.hash}>{d.id}</p>
            <p className={styles.empty}>
              Sealed to the record before it. If this one were altered, Verify would name it.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
