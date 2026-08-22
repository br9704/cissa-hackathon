import styles from "./StatusChip.module.css";

type Variant = "verified" | "draft" | "anchored" | "risk" | "neutral";

const GLYPH: Partial<Record<Variant, string>> = {
  /*
    Risk and draft carry a glyph as well as a colour. Colour alone is not allowed to be
    the only thing saying something essential, and these two are the only chips in the
    system whose meaning is load bearing.
  */
  risk: "!",
  draft: "○",
};

export function StatusChip({
  variant = "neutral",
  children,
}: {
  variant?: Variant;
  children: React.ReactNode;
}) {
  const glyph = GLYPH[variant];
  return (
    <span className={`${styles.chip} ${styles[variant]}`}>
      {glyph ? (
        <span className={styles.glyph} aria-hidden="true">
          {glyph}
        </span>
      ) : (
        <span className={styles.dot} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
