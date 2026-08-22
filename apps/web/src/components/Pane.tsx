import type { ReactNode } from "react";
import styles from "./Pane.module.css";

export function Pane({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.pane}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </header>
      {children}
    </section>
  );
}
