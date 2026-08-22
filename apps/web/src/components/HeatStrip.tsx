import { motion, useReducedMotion } from "motion/react";
import styles from "./HeatStrip.module.css";

export type HeatRow = { id: string; label: string; value: number; atRisk: boolean };

/*
  The firm map. One row per strategy, never one row per person: a bar chart of people is
  a league table however it is captioned, and this product does not have one.
*/
export function HeatStrip({ rows, format }: { rows: HeatRow[]; format?: (v: number) => string }) {
  const reduced = useReducedMotion();
  return (
    <div className={styles.strip}>
      {rows.map((row, i) => (
        <div key={row.id} className={styles.row}>
          <span className={styles.name}>{row.label}</span>
          <span className={styles.bar}>
            <motion.span
              className={`${styles.fill} ${row.atRisk ? styles.fillRisk : ""}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(row.value * 100)}%` }}
              transition={{
                duration: reduced ? 0.12 : 0.42,
                delay: reduced ? 0 : i * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </span>
          <span className={styles.reading}>
            {format ? format(row.value) : row.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}
