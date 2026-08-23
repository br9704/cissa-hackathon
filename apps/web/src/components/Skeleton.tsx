import styles from "./Skeleton.module.css";

/*
  Skeletons shaped like the thing that is coming.

  Not grey boxes. A skeleton whose proportions do not match the content it replaces produces
  a visible jump when the real thing lands, which is worse than a brief empty space: the eye
  has already started reading the wrong layout.

  Row widths vary deliberately, so a list reads as text arriving rather than as a bar chart.
*/
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.rows} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.row}>
          <span className={styles.bar} style={{ width: `${72 - (i % 3) * 13}%` }} />
          <span className={styles.bar} style={{ width: `${14 + (i % 2) * 6}%` }} />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.panel} aria-hidden="true">
      <span className={styles.bar} style={{ width: "38%", height: 13 }} />
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.bar} style={{ width: `${88 - i * 9}%` }} />
      ))}
    </div>
  );
}

/**
 * A veil over stale content that is refreshing.
 *
 * Blurs what is already there rather than blanking it, because the previous answer is
 * usually still useful while the next one loads, and replacing it with nothing throws away
 * information the reader had a second ago.
 */
export function RefreshVeil() {
  return <div className={styles.veil} aria-hidden="true" />;
}
