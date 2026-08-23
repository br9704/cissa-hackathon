/*
  The shared furniture for the six detail routes.
*/
import { Link } from "@tanstack/react-router";
import styles from "./Detail.module.css";

export function Back({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={styles.back}>
      <span aria-hidden="true">&larr;</span>
      {label}
    </Link>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {hint ? <span className={styles.sectionHint}>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className={styles.fact}>
      {label}
      <span className={styles.factValue}>{children}</span>
    </span>
  );
}

/*
  A named not found rather than a blank page.

  A deep link is a URL somebody can edit, paste from a stale document, or reach after the
  record it named was renamed. Rendering nothing looks like the app broke; saying what was
  not found tells the reader whether to check the link or the ledger.
*/
export function NotFound({ what, backTo, backLabel }: { what: string; backTo: string; backLabel: string }) {
  return (
    <div className={styles.page}>
      <Back to={backTo} label={backLabel} />
      <div className={styles.notFound}>
        <p>No {what} with that id is in the record.</p>
        <p className={styles.empty}>
          The link may be from an older export, or the id may be mistyped.
        </p>
      </div>
    </div>
  );
}

export { styles };
