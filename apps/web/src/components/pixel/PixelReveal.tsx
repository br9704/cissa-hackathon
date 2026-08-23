import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { pixelRuns, type GlyphName } from "./PixelIcon";
import styles from "./PixelReveal.module.css";

/*
  A glyph that materialises rather than fades.

  Used sparingly, on a first appearance that is worth marking. The rule that makes it look
  right is the same one the boot screen follows: opacity in two steps, never a smooth ramp. A
  smooth ramp on a hard pixel glyph produces grey half cells, which is exactly what
  crispEdges exists to prevent, and it reads as a blur rather than as a drawing.

  Runs light in order with a normalised delay, so the whole sweep takes the same time
  whatever the glyph, rather than a dense one taking twice as long as a sparse one.

  Reduced motion renders it drawn. Not frozen part way: the terminal state.
*/
export function PixelReveal({
  name,
  size = 20,
  className,
}: {
  name: GlyphName;
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const runs = pixelRuns(name);
  const [shown, setShown] = useState(reduced);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const last = Math.max(1, runs.length - 1);

  return (
    <svg
      ref={ref}
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {runs.map((r, i) => (
        <rect
          key={`${r.x}-${r.y}-${r.w}`}
          className={styles.cell}
          data-on={shown}
          style={{ transitionDelay: `${Math.round((i / last) * 140)}ms` }}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
        />
      ))}
    </svg>
  );
}
