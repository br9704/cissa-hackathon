import type { ReactNode } from "react";
import styles from "./Section.module.css";

export function Section({
  title,
  count,
  lead,
  aside,
  children,
}: {
  title: string;
  count?: ReactNode;
  /* Why this block is here. Omit when the title genuinely says it. */
  lead?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {count !== undefined ? <span className={styles.count}>{count}</span> : null}
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
      {children}
    </section>
  );
}
