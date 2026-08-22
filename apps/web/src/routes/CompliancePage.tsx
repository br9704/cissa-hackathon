import { useMemo, useState, useSyncExternalStore } from "react";
import {
  scoreStrategy, handoverPack, rts6ChangeLog, sr117Documentation,
} from "@continuity/core";
import styles from "./CompliancePage.module.css";
import { Markdown } from "../components/Markdown";
import { corpus, memberName, ago } from "../data/source";
import { accessLog, recordAccess, subscribeToAccessLog } from "../data/access";
import { isDesktop } from "../lib/shell";

type DocKind = "handover" | "rts6" | "sr117";

const DOC_LABEL: Record<DocKind, string> = {
  handover: "Handover pack, SYSC 25.9",
  rts6: "Change log, RTS 6 Art. 5(7)",
  sr117: "Model documentation, SR 11-7",
};

export function CompliancePage() {
  const c = corpus();
  const [kind, setKind] = useState<DocKind>("handover");
  const [memberId, setMemberId] = useState(
    c.members.find((m) => m.resignedOn)?.id ?? c.members[0]!.id,
  );
  const [strategyId, setStrategyId] = useState(c.strategies[0]!.id);
  const [pendingExport, setPendingExport] = useState(false);
  const [justification, setJustification] = useState("");

  /* The compliance officer is the one reading this screen, so exports are attributed to
     them rather than to whoever the document is about. */
  const viewer = c.members.find((m) => m.role === "compliance") ?? c.members[0]!;

  const log = useSyncExternalStore(subscribeToAccessLog, accessLog, accessLog);

  const scores = useMemo(() => {
    const authors = new Map(c.decisions.map((d) => [d.id, d.authorMemberId]));
    return new Map(
      c.strategies.map((s) => [
        s.id,
        scoreStrategy({
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
      ]),
    );
  }, [c]);

  /*
    A fixed generation timestamp so the same corpus produces the same document, which is
    what makes the pack hash worth storing. In the deployed build this is the moment the
    pack was generated and it is written onto the row.
  */
  const GENERATED_AT = "2026-08-21T09:00:00.000Z";
  const THROUGH_EVENT = c.decisions.length;

  const document = useMemo(() => {
    if (kind === "handover") {
      const member = c.members.find((m) => m.id === memberId)!;
      return handoverPack({
        firmName: c.firmName,
        member,
        strategies: c.strategies,
        decisions: c.decisions,
        questions: c.questions,
        sessions: c.sessions,
        turns: c.turns,
        scores,
        throughEvent: THROUGH_EVENT,
        generatedAt: GENERATED_AT,
      });
    }
    const strategy = c.strategies.find((s) => s.id === strategyId)!;
    if (kind === "rts6") {
      return rts6ChangeLog({
        firmName: c.firmName,
        strategy,
        decisions: c.decisions,
        memberName,
        throughEvent: THROUGH_EVENT,
        generatedAt: GENERATED_AT,
      });
    }
    return sr117Documentation({
      firmName: c.firmName,
      strategy,
      decisions: c.decisions,
      questions: c.questions,
      score: scores.get(strategy.id),
      memberName,
      throughEvent: THROUGH_EVENT,
      generatedAt: GENERATED_AT,
    });
  }, [kind, memberId, strategyId, c, scores, THROUGH_EVENT]);

  const documentTitle =
    kind === "handover"
      ? `Handover pack for ${memberName(memberId)}`
      : `${DOC_LABEL[kind]}, ${c.strategies.find((s) => s.id === strategyId)!.name}`;

  const subjects =
    kind === "handover"
      ? [memberId]
      : Array.from(
          new Set(
            c.decisions.filter((d) => d.strategyId === strategyId).map((d) => d.authorMemberId),
          ),
        );

  function confirmExport() {
    recordAccess({
      kind: "access_export",
      actorMemberId: viewer.id,
      target: documentTitle,
      subjectMemberIds: subjects,
      justification: justification.trim(),
    });
    setPendingExport(false);
    setJustification("");

    /*
      window.print() is unreliable inside the macOS webview: it produces a blank or empty
      PDF despite a correct page count, and there is still no official Tauri print
      plugin. In the desktop shell the honest thing is to say so rather than hand
      somebody a broken export.
    */
    if (isDesktop) {
      window.alert(
        "Printing from the desktop shell is unreliable on macOS. Open this route in the web app to export the PDF.",
      );
      return;
    }
    window.print();
  }

  return (
    <div className={styles.page}>
      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>Compliance artifacts</h2>
          <span className={styles.note}>
            Generated from the ledger, labelled DRAFT, traceable to an event
          </span>
        </header>

        <div className={styles.picker}>
          {(Object.keys(DOC_LABEL) as DocKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={styles.tab}
              data-active={k === kind}
              onClick={() => setKind(k)}
            >
              {DOC_LABEL[k]}
            </button>
          ))}
        </div>

        <div className={styles.subjectRow}>
          <span className={styles.subjectLabel}>
            {kind === "handover" ? "For" : "Strategy"}
          </span>
          {kind === "handover"
            ? c.members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={styles.tab}
                  data-active={m.id === memberId}
                  onClick={() => setMemberId(m.id)}
                >
                  {m.displayName}
                </button>
              ))
            : c.strategies.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.tab}
                  data-active={s.id === strategyId}
                  onClick={() => setStrategyId(s.id)}
                >
                  {s.name}
                </button>
              ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => setPendingExport(true)}
          >
            Export
          </button>
          <span className={styles.note}>
            Exporting appends an access event to the ledger, with your reason on it.
          </span>
        </div>

        {pendingExport ? (
          <div className={styles.checkpoint}>
            <span className={styles.checkpointTitle}>Why do you need this export?</span>
            <p className={styles.checkpointBody}>
              One line, stored on the ledger alongside who you are and what you took. The
              people whose contributions are in this document can read it. That is the
              point: a justification nobody can see changes nothing, and one the subject
              can see changes quite a lot.
            </p>
            <input
              className={styles.checkpointInput}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && justification.trim().length > 3) confirmExport();
              }}
              placeholder="Regulatory request, internal review, onboarding a successor"
              aria-label="Reason for export"
              autoFocus
            />
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={confirmExport}
                disabled={justification.trim().length < 4}
              >
                Record and export
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => setPendingExport(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className={styles.docWrap}>
          <Markdown source={document} />
        </div>
      </section>

      <section className={styles.pane}>
        <header className={styles.head}>
          <h2 className={styles.title}>Access log</h2>
          <span className={styles.note}>
            Reads and exports are events on the same ledger as everything else
          </span>
        </header>
        {log.length === 0 ? (
          <p className={styles.empty}>
            Nothing yet this session. Export a document and it appears here, and in the
            My Record view of everybody whose contributions it touched.
          </p>
        ) : (
          <div>
            {log.map((e) => (
              <div className={styles.accessRow} key={e.id}>
                <span className={styles.accessWhen}>{ago(e.at, Date.now())}</span>
                <span className={styles.accessWhat}>
                  {memberName(e.actorMemberId)}{" "}
                  {e.kind === "access_export" ? "exported" : "opened"} {e.target}
                  {e.justification ? (
                    <>
                      {" "}
                      <span className={styles.accessWhy}>"{e.justification}"</span>
                    </>
                  ) : null}
                </span>
                <span className={styles.accessWhen}>
                  {e.subjectMemberIds.length} member
                  {e.subjectMemberIds.length === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
