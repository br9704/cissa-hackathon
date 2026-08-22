import { useMemo } from "react";
import styles from "./LedgerPage.module.css";
import { LedgerRail } from "../components/LedgerRail";
import { corpus, ledger, backend } from "../data/source";

export function LedgerPage() {
  const entries = useMemo(() => ledger(), []);
  const c = corpus();

  const drafts = entries.filter((e) => e.draft).length;
  const risk = entries.filter((e) => e.riskFlag).length;

  return (
    <div className={styles.page}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{entries.length}</span>
          <span className={styles.statLabel}>Events on the chain</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{c.artifacts.length}</span>
          <span className={styles.statLabel}>Captured artifacts</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{risk}</span>
          <span className={styles.statLabel}>Risk flagged decisions</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{drafts}</span>
          <span className={styles.statLabel}>Awaiting approval</span>
        </div>
      </div>

      <section className={styles.railPane}>
        <header className={styles.railHeader}>
          <h2 className={styles.railTitle}>Ledger</h2>
          <span className={styles.railNote}>
            {backend === "local"
              ? "Local corpus, the same one the seed loads"
              : "Live tail"}
          </span>
        </header>
        <LedgerRail entries={entries} />
      </section>
    </div>
  );
}
