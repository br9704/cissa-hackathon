import { motion, useReducedMotion } from "motion/react";
import styles from "./LedgerRow.module.css";
import { StatusChip } from "./StatusChip";
import { Link } from "@tanstack/react-router";
import { ago, memberInitials, memberName, strategyName, TYPE_LABEL, type LedgerEntry } from "../data/source";

export function LedgerRow({
  entry,
  fresh = false,
  onSelect,
}: {
  entry: LedgerEntry;
  /* True only for a row that just landed, so the sweep plays once and never again. */
  fresh?: boolean;
  onSelect?: (entry: LedgerEntry) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={styles.wrap}>
      {/*
        A row is a link, not a button.

        It was a button calling onSelect, and on the ledger page nothing was listening, so
        every one of 184 rows was a dead end. As a real anchor it also gets middle click,
        open in new tab, and a status bar preview for free, which a click handler never does.
      */}
      <Link
        to="/decision/$id"
        params={{ id: entry.id }}
        className={styles.row}
        onClick={() => onSelect?.(entry)}
        aria-label={`${entry.title}, ${strategyName(entry.strategyId)}, by ${memberName(entry.actorMemberId)}`}
      >
        <span className={styles.when}>{ago(entry.occurredAt)}</span>

        <span className={styles.title}>
          <span className={styles.headline}>{entry.title}</span>
          <span className={styles.sub}>{strategyName(entry.strategyId)}</span>
        </span>

        <span className={styles.chips}>
          {entry.riskFlag ? <StatusChip variant="risk">Risk</StatusChip> : null}
          {entry.draft ? (
            <StatusChip variant="draft">Drafted</StatusChip>
          ) : (
            <StatusChip variant="verified">Chained</StatusChip>
          )}
          {entry.decisionType ? (
            <StatusChip>{TYPE_LABEL[entry.decisionType] ?? entry.decisionType}</StatusChip>
          ) : null}
        </span>

        <span className={styles.author} title={memberName(entry.actorMemberId)}>
          {memberInitials(entry.actorMemberId)}
        </span>
      </Link>

      {fresh && !entry.draft ? (
        <motion.span
          className={styles.verifiedSweep}
          aria-hidden="true"
          initial={{ width: reduced ? "100%" : 0, opacity: reduced ? 0 : 1 }}
          animate={{ width: "100%", opacity: reduced ? 0 : 1 }}
          transition={{ duration: reduced ? 0.1 : 0.42, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
    </div>
  );
}
