import { useMemo } from "react";
import { AnimatePresence } from "motion/react";
import styles from "./LedgerRail.module.css";
import { LedgerRow } from "./LedgerRow";
import type { LedgerEntry } from "../data/source";

/*
  Groups by day rather than paginating. A ledger is read the way a log is read: you scan
  down until something is unfamiliar, and page boundaries break that. The day headers are
  the only chrome, and they stick so you never lose your place in a long scroll.
*/
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function LedgerRail({
  entries,
  freshId,
  onSelect,
  limit = 60,
}: {
  entries: LedgerEntry[];
  freshId?: string;
  onSelect?: (entry: LedgerEntry) => void;
  limit?: number;
}) {
  const groups = useMemo(() => {
    const out: { day: string; rows: LedgerEntry[] }[] = [];
    for (const entry of entries.slice(0, limit)) {
      const day = dayLabel(entry.occurredAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.rows.push(entry);
      else out.push({ day, rows: [entry] });
    }
    return out;
  }, [entries, limit]);

  return (
    <div className={styles.rail}>
      {/*
        One AnimatePresence around the whole rail, not one per row. The capture to ledger
        flight is a shared layoutId handoff between the draft card and the row it becomes,
        and that only works if both ends live inside the same presence tree.
      */}
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <div key={group.day}>
            <div className={styles.groupLabel}>{group.day}</div>
            {group.rows.map((entry) => (
              <LedgerRow
                key={entry.id}
                entry={entry}
                fresh={entry.id === freshId}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </AnimatePresence>
      {entries.length > limit ? (
        <div className={styles.footer}>
          Showing {limit} of {entries.length} events
        </div>
      ) : null}
    </div>
  );
}
