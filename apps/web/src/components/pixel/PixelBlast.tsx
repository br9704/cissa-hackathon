import styles from "./PixelBlast.module.css";

/**
 * The corner texture. Decorative, aria-hidden, and behind everything.
 *
 * Two of them, diagonally opposite, so the eye reads a lit field rather than a vignette.
 */
export function PixelBlast() {
  return (
    <>
      <div className={`${styles.blast} ${styles.topRight}`} aria-hidden="true" />
      <div className={`${styles.blast} ${styles.bottomLeft}`} aria-hidden="true" />
    </>
  );
}
