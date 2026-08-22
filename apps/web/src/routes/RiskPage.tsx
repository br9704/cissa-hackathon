import { useMemo, useState } from "react";
import { scoreStrategy, simulateDeparture, departureExposure } from "@continuity/core";
import { motion, useReducedMotion } from "motion/react";
import styles from "./RiskPage.module.css";
import { PageHeader } from "../components/PageHeader";
import { RiskDial } from "../components/RiskDial";
import { HeatStrip, type HeatRow } from "../components/HeatStrip";
import { GenealogyGraph } from "../components/GenealogyGraph";
import { StatusChip } from "../components/StatusChip";
import { corpus, memberInitials, memberName, strategyName } from "../data/source";

/* Above this share of the recorded reasoning, one person effectively holds the book. */
const CONCENTRATION_RISK = 0.5;

export function RiskPage() {
  const c = corpus();
  const reduced = useReducedMotion();
  const [maskedId, setMaskedId] = useState<string | null>(null);

  const authors = useMemo(
    () => new Map(c.decisions.map((d) => [d.id, d.authorMemberId])),
    [c.decisions],
  );

  const scores = useMemo(
    () =>
      c.strategies.map((s) => ({
        strategy: s,
        score: scoreStrategy({
          strategyId: s.id,
          items: c.decisions
            .filter((d) => d.strategyId === s.id)
            .map((d) => ({
              strategyId: s.id,
              authorMemberId: d.authorMemberId,
              weight: d.riskFlag ? 2 : 1,
            })),
          openQuestions: c.questions.filter((q) => q.strategyId === s.id),
          decisionAuthors: authors,
        }),
      })),
    [c, authors],
  );

  const departure = useMemo(
    () => (maskedId ? simulateDeparture(maskedId, c.decisions) : null),
    [maskedId, c.decisions],
  );

  const exposure = useMemo(
    () =>
      maskedId
        ? departureExposure(
            maskedId,
            c.strategies.map((s) => ({ id: s.id, name: s.name, revenueUsdM: s.revenueUsdM })),
            new Map(scores.map(({ strategy, score }) => [strategy.id, score])),
          )
        : null,
    [maskedId, c.strategies, scores],
  );

  /* Firm level readings. Worst case rather than average: a desk is as exposed as its
     most concentrated book, and averaging that away is how a risk board becomes
     decorative. */
  const worstBus = Math.min(...scores.map((s) => s.score.busFactor));
  const worstReadiness = Math.min(...scores.map((s) => s.score.vacationReadiness));
  const flagged = scores.filter((s) => s.score.concentration >= CONCENTRATION_RISK).length;

  const heat: HeatRow[] = scores.map(({ strategy, score }) => ({
    id: strategy.id,
    label: strategy.name,
    value: score.concentration,
    atRisk: score.concentration >= CONCENTRATION_RISK,
  }));

  const graph = useMemo(() => {
    const ids = new Set(c.decisions.map((d) => d.id));
    return {
      nodes: c.decisions.map((d) => ({
        id: d.id,
        title: d.title,
        decisionType: d.decisionType,
        riskFlag: d.riskFlag,
        authorMemberId: d.authorMemberId,
      })),
      edges: c.links
        .filter((l) => ids.has(l.parent) && ids.has(l.child))
        .map((l) => ({ source: l.parent, target: l.child, relation: l.relation })),
    };
  }, [c]);

  const orphans = departure
    ? departure.orphanedIds
        .map((id) => c.decisions.find((d) => d.id === id)!)
        .sort((a, b) => Number(b.riskFlag) - Number(a.riskFlag))
    : [];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Knowledge risk"
        lead={
          "Which strategies depend on one person understanding them, and what would leave with that" +
          " person. Finance already runs this fire drill: two weeks of mandatory leave with system " +
          "access cut. Nobody scores whether the desk would pass it."
        }
      />

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>Where the desk stands today</h2>
          <span className={styles.note}>
            Scored per strategy, never per person
          </span>
        </header>

        <div className={styles.dials}>
          <RiskDial
            value={worstBus}
            max={5}
            label="Bus factor, worst book"
            caption="one person could take a book with them"
            atRisk={worstBus <= 1}
          />
          <RiskDial
            value={worstReadiness}
            max={100}
            label="Could cover a leave"
            caption="of open questions somebody else could answer"
            atRisk={worstReadiness < 70}
          />
          <RiskDial
            value={flagged}
            max={c.strategies.length}
            label="Concentrated"
            caption={`of ${c.strategies.length} books rest mostly on one person`}
            atRisk={flagged > 0}
          />
          <RiskDial
            value={c.questions.filter((q) => !q.answeredByDecisionId).length}
            max={c.questions.length}
            label="Unanswered"
            caption="questions with no recorded answer"
            atRisk={c.questions.some((q) => !q.answeredByDecisionId)}
          />
        </div>

        <HeatStrip rows={heat} format={(v) => v.toFixed(2)} />
        <p className={styles.doctrine}>
          Concentration is a Herfindahl index over who recorded the reasoning, weighted so
          a risk flagged decision counts double. It describes a strategy. There is no
          per person score anywhere in this product, and there is not going to be one.
        </p>
      </section>

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>If somebody resigned tomorrow</h2>
          <span className={styles.note}>
            Pick a name. Nothing is sent anywhere, this is a calculation.
          </span>
        </header>

        <div className={styles.people}>
          {c.members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.person}
              data-active={m.id === maskedId}
              onClick={() => setMaskedId(m.id === maskedId ? null : m.id)}
            >
              <span className={styles.avatar}>{memberInitials(m.id)}</span>
              {m.displayName}
            </button>
          ))}
        </div>

        {exposure && exposure.exposedUsdM > 0 ? (
          <motion.div
            className={styles.exposure}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.exposureFigure}>
              <span className={styles.exposureNumber}>
                ${exposure.exposedUsdM.toLocaleString("en-US")}M
              </span>
              <span className={styles.exposureUnit}>
                of attributed annual revenue, with no second author
              </span>
            </div>
            <p className={styles.exposureLead}>
              {memberName(maskedId)} holds the majority of the recorded reasoning on{" "}
              {exposure.exposed.map((s) => s.name).join(" and ")}, and on{" "}
              {exposure.exposed.length === 1 ? "it" : "both"} the bus factor is one. If the
              reasoning is not captured before the last day, it is not captured.
            </p>
            <div className={styles.exposureBreakdown}>
              {exposure.exposed.map((s) => (
                <span key={s.id} className={styles.exposureItem}>
                  {s.name}
                  <span className={styles.exposureItemValue}>${s.revenueUsdM}M</span>
                </span>
              ))}
              {exposure.partialUsdM > 0 ? (
                <span className={styles.exposureItem}>
                  covered elsewhere
                  <span className={styles.exposureItemValue}>${exposure.partialUsdM}M</span>
                </span>
              ) : null}
            </div>
            <p className={styles.synthetic}>
              Synthetic figures for a synthetic firm. The arithmetic is the honest part:
              this sums the attributed revenue of the books where this person is the top
              holder AND the bus factor is one. A book somebody else has also written
              about is listed as covered and is not counted, however much they wrote.
            </p>
          </motion.div>
        ) : null}

        <div className={styles.split}>
          <div>
            {/*
              Selecting someone desaturates the whole graph and leaves only their orphaned
              decisions at full strength. It reads as loss rather than as an alert,
              which is the honest shape: nothing has gone wrong yet, it is about to.
            */}
            <GenealogyGraph
              nodes={graph.nodes}
              edges={graph.edges}
              highlighted={departure ? new Set(departure.orphanedIds) : null}
            />
          </div>

          <div className={styles.findings}>
            {departure ? (
              <>
                <div className={styles.summary}>
                  <span className={styles.summaryLead}>
                    <span aria-hidden="true">!</span>
                    {orphans.length} decisions only {memberName(maskedId)} has recorded
                  </span>
                  <span className={styles.summaryBody}>
                    Across{" "}
                    {[...departure.byStrategy.entries()]
                      .map(([sid, n]) => `${strategyName(sid)} (${n})`)
                      .join(" and ")}
                    . Nobody else has written anything about the same ground, so if the
                    reasoning is not captured before the last day it is not captured.
                  </span>
                </div>
                <div className={styles.orphans}>
                  {orphans.map((d) => (
                    <div key={d.id} className={styles.orphan}>
                      <span className={styles.orphanTitle}>
                        {d.riskFlag ? <StatusChip variant="risk">Risk</StatusChip> : null}{" "}
                        {d.title}
                      </span>
                      <span className={styles.orphanSub}>{strategyName(d.strategyId)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.placeholder}>
                Nobody selected. The simulation masks one person and asks which recorded
                decisions nobody else has touched the same ground on. It is the fire drill
                that FINRA and NY DFS already make firms run, with a score attached.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
