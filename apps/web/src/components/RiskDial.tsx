import { motion, useReducedMotion } from "motion/react";
import styles from "./RiskDial.module.css";

const SIZE = 96;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
/* Three quarters of a circle, opening at the bottom, so the gap reads as a scale rather
   than as a ring that failed to close. */
const SWEEP = 0.75;

export function RiskDial({
  value,
  max = 100,
  label,
  caption,
  atRisk = false,
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  atRisk?: boolean;
}) {
  const reduced = useReducedMotion();
  const fraction = Math.max(0, Math.min(1, value / max));
  const arc = CIRC * SWEEP;

  return (
    <div className={styles.dial}>
      <svg
        className={styles.svg}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${label}: ${value} of ${max}`}
      >
        <g transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            className={styles.track}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            strokeDasharray={`${arc} ${CIRC}`}
            strokeLinecap="round"
          />
          <motion.circle
            className={`${styles.value} ${atRisk ? styles.atRisk : ""}`}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeWidth={STROKE}
            strokeDasharray={`${arc * fraction} ${CIRC}`}
            initial={{ strokeDasharray: `0 ${CIRC}` }}
            animate={{ strokeDasharray: `${arc * fraction} ${CIRC}` }}
            transition={{ duration: reduced ? 0.12 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>
        <text
          className={`${styles.reading} ${atRisk ? styles.readingRisk : ""}`}
          x={SIZE / 2}
          y={SIZE / 2}
        >
          {value}
        </text>
      </svg>
      <span className={styles.label}>{label}</span>
      {caption ? <span className={styles.caption}>{caption}</span> : null}
    </div>
  );
}
