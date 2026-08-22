import { useCallback, useMemo, useState } from "react";
import { scoreStrategy } from "@continuity/core";
import styles from "./StrategiesPage.module.css";
import { GenealogyGraph } from "../components/GenealogyGraph";
import { TimeMachine, type ReplayItem } from "../components/TimeMachine";
import { StatusChip } from "../components/StatusChip";
import { corpus, memberName, TYPE_LABEL } from "../data/source";

export function StrategiesPage() {
  const c = corpus();
  const [activeId, setActiveId] = useState(c.strategies[0]!.id);
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [replay, setReplay] = useState<{ visible: Set<string>; atRisk: Set<string> } | null>(null);

  /* Stable identity, or TimeMachine's effect fires on every parent render. */
  const onReplay = useCallback(
    (state: { visible: Set<string>; atRisk: Set<string> }) => setReplay(state),
    [],
  );

  /*
    Memoised, and it is not a performance tweak.

    This object is a dependency of TimeMachine's state memo, which drives an effect that
    calls back into this component's setState. Built inline it has a new identity on every
    render, so the memo recomputes, the effect fires, the parent re-renders, and the
    object is new again: "Maximum update depth exceeded", a blank page, and a stack that
    points at React.

    Any object or array handed to a child that feeds an effect has to be stable. The
    callback below is memoised for the same reason.
  */
  const resignation = useMemo(() => {
    const who = c.members.find((m) => m.resignedOn);
    return who ? { memberId: who.id, on: who.resignedOn!, name: who.displayName } : null;
  }, [c.members]);

  const authors = useMemo(
    () => new Map(c.decisions.map((d) => [d.id, d.authorMemberId])),
    [c.decisions],
  );

  const scores = useMemo(
    () =>
      new Map(
        c.strategies.map((s) => [
          s.id,
          scoreStrategy({
            strategyId: s.id,
            items: c.decisions
              .filter((d) => d.strategyId === s.id)
              .map((d) => ({
                strategyId: s.id,
                authorMemberId: d.authorMemberId,
                /* A risk flagged decision is worth more to a successor, so it weighs
                   more in the concentration maths. */
                weight: d.riskFlag ? 2 : 1,
              })),
            openQuestions: c.questions.filter((q) => q.strategyId === s.id),
            decisionAuthors: authors,
          }),
        ]),
      ),
    [c, authors],
  );

  const active = c.strategies.find((s) => s.id === activeId)!;

  /* Same reason as `resignation`: this array feeds a memo that feeds an effect. */
  const replayItems = useMemo<ReplayItem[]>(
    () =>
      c.decisions
        .filter((d) => d.strategyId === activeId)
        .map((d) => ({
          id: d.id,
          occurredAt: d.occurredAt,
          authorMemberId: d.authorMemberId,
          riskFlag: d.riskFlag,
        })),
    [c.decisions, activeId],
  );

  const graph = useMemo(() => {
    const decisions = c.decisions.filter((d) => d.strategyId === activeId);
    const ids = new Set(decisions.map((d) => d.id));
    return {
      nodes: decisions.map((d) => ({
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
  }, [c, activeId]);

  const decision = selectedDecision
    ? c.decisions.find((d) => d.id === selectedDecision)
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {c.strategies.map((s) => {
          const score = scores.get(s.id)!;
          return (
            <button
              key={s.id}
              type="button"
              className={styles.card}
              data-active={s.id === activeId}
              onClick={() => {
                setActiveId(s.id);
                setSelectedDecision(null);
              }}
            >
              <span className={styles.cardHead}>
                <span className={styles.name}>{s.name}</span>
                <StatusChip variant={s.status === "live" ? "verified" : "neutral"}>
                  {s.status}
                </StatusChip>
              </span>
              <span className={styles.desc}>{s.description}</span>
              <span className={styles.metrics}>
                <span className={styles.metric}>
                  <span
                    className={`${styles.metricValue} ${score.busFactor <= 1 ? styles.atRisk : ""}`}
                  >
                    {score.busFactor}
                  </span>
                  <span className={styles.metricLabel}>bus factor</span>
                </span>
                <span className={styles.metric}>
                  <span className={styles.metricValue}>
                    {score.concentration.toFixed(2)}
                  </span>
                  <span className={styles.metricLabel}>concentration</span>
                </span>
                <span className={styles.metric}>
                  <span className={styles.metricValue}>
                    {c.decisions.filter((d) => d.strategyId === s.id).length}
                  </span>
                  <span className={styles.metricLabel}>decisions</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <section className={styles.detail}>
        <header className={styles.detailHead}>
          <h2 className={styles.detailTitle}>{active.name}</h2>
          <span className={styles.chips}>
            <StatusChip>{`${graph.nodes.length} decisions`}</StatusChip>
            <StatusChip>{`${graph.edges.length} links`}</StatusChip>
            <StatusChip>{`owner ${memberName(scores.get(activeId)!.topHolderMemberId)}`}</StatusChip>
          </span>
        </header>

        <GenealogyGraph
          nodes={graph.nodes}
          edges={graph.edges}
          visible={replay?.visible ?? null}
          /* Once the replay passes the resignation, only the orphaned work stays lit.
             Before it, nothing is highlighted and the whole graph reads normally. */
          highlighted={replay && replay.atRisk.size > 0 ? replay.atRisk : null}
          selectedId={selectedDecision}
          onSelect={setSelectedDecision}
        />

        <TimeMachine
          items={replayItems}
          resignation={resignation}
          onChange={onReplay}
        />

        {decision ? (
          <div className={styles.selected}>
            <div className={styles.selectedTitle}>{decision.title}</div>
            <div className={styles.chips}>
              {decision.riskFlag ? <StatusChip variant="risk">Risk</StatusChip> : null}
              <StatusChip>{TYPE_LABEL[decision.decisionType] ?? decision.decisionType}</StatusChip>
              <StatusChip>{memberName(decision.authorMemberId)}</StatusChip>
              {decision.draftedBy === "model" ? (
                <StatusChip variant="draft">Drafted by model</StatusChip>
              ) : null}
            </div>
            <p className={styles.selectedWhy}>{decision.why}</p>
            {decision.alternatives.length ? (
              <ul className={styles.alts}>
                {decision.alternatives.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className={styles.hint}>
            Select a node to read the decision behind it, including what was rejected.
          </p>
        )}
      </section>
    </div>
  );
}
