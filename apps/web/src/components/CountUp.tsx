import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/*
  A number that arrives rather than appearing.

  Used for exactly one thing: the dollar figure a departure would put at risk. That number is
  the moment the abstraction becomes concrete, and having it blink into existence wastes it.
  Counting it up makes a reader watch it climb, which is a second of attention on the one
  figure that matters.

  Not decoration, and deliberately not used anywhere else. A product where every number
  counts up is a product where none of them mean anything.

  Reduced motion gets the final value immediately, which is the terminal state rather than a
  frozen mid count: somebody who asked for less motion still needs the number.
*/
export function CountUp({
  value,
  durationMs = 800,
  format = (n: number) => n.toLocaleString("en-US"),
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const started = performance.now();
    const from = 0;

    function tick(now: number) {
      const t = Math.min(1, (now - started) / durationMs);
      /* Ease out cubic: fast at the start, settling at the end, so the eye catches the
         magnitude early and the last digits arrive calmly rather than racing. */
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, durationMs, reduced]);

  /* aria-live is deliberately absent: announcing every intermediate value would flood a
     screen reader with numbers that were never true. The final value is in the DOM. */
  return <>{format(shown)}</>;
}
