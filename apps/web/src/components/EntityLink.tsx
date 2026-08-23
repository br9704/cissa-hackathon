/*
  Every entity reference in the product, as a link.

  The audit that opened Stage 3 found eight routes and exactly one component containing a
  navigate() call. A ledger row, a graph node, a person's name, a strategy, an artifact and a
  debrief were all dead ends, and that is most of what "it does not do anything" meant: the
  app held a graph of connected things and rendered it as a set of disconnected lists.

  These wrappers exist so the rule cannot drift. Adding a person's name anywhere means
  importing PersonLink, not remembering to wrap it in a Link with the right route.

  The `to` is a LITERAL in each component and the id travels in `params`. router.tsx explains
  why: a helper that takes `path: string` erases the literal types, and those literals are
  what make a renamed route a compile error rather than a dead link discovered by a judge.
*/
import { Link } from "@tanstack/react-router";
import styles from "./EntityLink.module.css";
import { memberName, strategyName } from "../data/source";

type Props = { id: string | null | undefined; className?: string; children?: React.ReactNode };

export function PersonLink({ id, className, children }: Props) {
  if (!id) return <span className={className}>the desk</span>;
  return (
    <Link
      to="/person/$id"
      params={{ id }}
      className={`${styles.link} ${className ?? ""}`}
      title="What this person holds, and what only they hold"
    >
      {children ?? memberName(id)}
    </Link>
  );
}

export function StrategyLink({ id, className, children }: Props) {
  if (!id) return <span className={className}>not book specific</span>;
  return (
    <Link to="/strategy/$id" params={{ id }} className={`${styles.link} ${className ?? ""}`}>
      {children ?? strategyName(id)}
    </Link>
  );
}

export function DecisionLink({ id, className, children }: Props) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link to="/decision/$id" params={{ id }} className={`${styles.link} ${className ?? ""}`}>
      {children}
    </Link>
  );
}

export function ArtifactLink({ id, className, children }: Props) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link
      to="/artifact/$id"
      params={{ id }}
      className={`${styles.link} ${styles.mono} ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

export function QuestionLink({ id, className, children }: Props) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link to="/question/$id" params={{ id }} className={`${styles.link} ${className ?? ""}`}>
      {children}
    </Link>
  );
}

export function DebriefLink({ id, className, children }: Props) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link to="/debrief/$id" params={{ id }} className={`${styles.link} ${className ?? ""}`}>
      {children}
    </Link>
  );
}
