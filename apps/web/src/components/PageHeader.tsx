import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

export function PageHeader({
  title,
  lead,
  aside,
}: {
  title: string;
  /* One sentence, in plain words, about what this screen is for. */
  lead: string;
  aside?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <h1 className={styles.title}>{title}</h1>
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      <p className={styles.lead}>{lead}</p>
    </header>
  );
}
