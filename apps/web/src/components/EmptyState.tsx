import styles from "./EmptyState.module.css";

type Props = {
  title: string;
  body: string;
  /* The capture surface that would fill this pane. Every empty state names one. */
  hint?: string;
  shortcut?: string;
};

export function EmptyState({ title, body, hint, shortcut }: Props) {
  return (
    <div className={styles.empty}>
      <div className={styles.title}>{title}</div>
      <p className={styles.body}>{body}</p>
      {hint ? (
        <div className={styles.hint}>
          {shortcut ? <kbd className={styles.kbd}>{shortcut}</kbd> : null}
          <span>{hint}</span>
        </div>
      ) : null}
    </div>
  );
}
