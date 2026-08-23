/*
  The mark.

  It was the letter C in a rounded square, which is the placeholder every project starts
  with and the one the owner named as the thing that looked unfinished.

  The glyph is two links holding, drawn on the same twelve by twelve grid as the icon set,
  because that is what this product is: each record sealed to the one before it, and the
  chain only means something while every link holds. A mark that says what the product does
  is worth more than a lettermark that says what it is called.

  Composed from the same run data the icons compile from, so the mark and the nav are
  literally the same drawing system rather than two things that happen to look similar.
*/
import { pixelRuns } from "./PixelIcon";
import styles from "./PixelMark.module.css";

export function PixelMark({ size = 22, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      className={styles.mark}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {pixelRuns("link").map((r) => (
        <rect key={`${r.x}-${r.y}-${r.w}`} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  );
}

/**
 * The wordmark lockup: the mark, then the name.
 *
 * The name is set in the interface face rather than a display face on purpose. This is
 * product chrome that sits beside navigation all day, and a wordmark that shouts competes
 * with the thing it is labelling.
 */
export function Wordmark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className={styles.lockup}>
      <PixelMark size={22} title="Continuity" />
      {collapsed ? null : <span className={styles.word}>Continuity</span>}
    </span>
  );
}
