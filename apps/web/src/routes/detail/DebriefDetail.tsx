import { useParams } from "@tanstack/react-router";
import { corpus } from "../../data/source";
import { StatusChip } from "../../components/StatusChip";
import { PersonLink, StrategyLink, ArtifactLink } from "../../components/EntityLink";
import { Back, Section, Fact, NotFound, styles } from "./parts";

/*
  One debrief session, turn by turn.

  The grounding is shown per answer rather than summarised at the top, because "this person
  said this, and here is the artifact they were looking at" is the claim, and a citation
  attached to a whole session rather than a sentence is not really a citation.
*/
export function DebriefDetail() {
  const { id } = useParams({ from: "/debrief/$id" });
  const c = corpus();
  const s = c.sessions.find((x) => x.id === id);
  if (!s) return <NotFound what="debrief" backTo="/debriefs" backLabel="Debriefs" />;

  const turns = c.turns.filter((t) => t.sessionId === s.id).sort((a, b) => a.seq - b.seq);

  return (
    <div className={styles.page}>
      <Back to="/debriefs" label="Debriefs" />
      <div className={styles.eyebrow}>Debrief</div>
      <h1 className={styles.title}>{s.triggerReason.replace(/_/g, " ")}</h1>

      <div className={styles.facts}>
        <Fact label="with">
          <PersonLink id={s.memberId} />
        </Fact>
        <Fact label="about">
          <StrategyLink id={s.strategyId} />
        </Fact>
        <Fact label="scheduled">{s.scheduledFor.slice(0, 10)}</Fact>
        <StatusChip variant={s.completedAt ? "verified" : "neutral"}>
          {s.completedAt ? "completed" : "not yet held"}
        </StatusChip>
      </div>

      <Section title="The conversation" hint={`${turns.length} turns`}>
        {turns.length === 0 ? (
          <p className={styles.empty}>This session has not been held yet.</p>
        ) : (
          <div className={styles.list}>
            {turns.map((t) => (
              <div key={`${t.sessionId}-${t.seq}`} className={styles.row}>
                <span className={styles.rowMeta}>
                  {t.role === "agent" ? "asked" : "answered"}
                </span>
                <span className={styles.body} style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                  {t.text}
                  {t.groundedArtifactIds.length > 0 ? (
                    <span className={styles.rowMeta}>
                      {" "}
                      {t.groundedArtifactIds.map((aid) => (
                        <ArtifactLink key={aid} id={aid}>
                          {aid.slice(0, 12)}
                        </ArtifactLink>
                      ))}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
