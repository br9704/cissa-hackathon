import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./BootScreen.module.css";
import { pixelRuns } from "../components/pixel/PixelIcon";
import { aggregate, currentLabel, subscribe } from "./assets";

/*
  The boot screen.

  It shows the mark assembling cell by cell while the app actually loads, with a readout
  naming what is happening and a bar driven by real weighted progress.

  Three rules it obeys, each because breaking one is a familiar way to look amateur:

    It never strands. A hard cap finishes the boot whatever the manifest says, because an
    asset that never reports is a bug in that asset and not a reason to hold the door shut.

    It never flickers. A minimum fill time means a warm cache still reads as a boot rather
    than as a flash of something, and there is a terminal surge so it does not crawl at the
    end, which is where a slow bar is most annoying.

    It is shown once per session and skipped entirely under reduced motion and inside the
    quick capture window, which is a 560 by 132 floating panel where a progress screen would
    be absurd.
*/

const MIN_FILL_MS = 400;
const HARD_CAP_MS = 4000;

function useProgress(): { value: number; label: string } {
  const version = useSyncExternalStore(
    subscribe,
    () => `${aggregate()}|${currentLabel()}`,
    () => "0|",
  );
  void version;
  return { value: aggregate(), label: currentLabel() };
}

export function BootScreen({ onDone }: { onDone: () => void }) {
  const runs = pixelRuns("link");
  const { value, label } = useProgress();
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(performance.now());

  /*
    The displayed value chases the true one rather than jumping to it, with a surge once the
    real work is nearly finished. The floor keeps it honest in the other direction: it can
    never show more than time has actually elapsed against the minimum.
  */
  useEffect(() => {
    let raf = 0;
    function tick() {
      const elapsed = performance.now() - started.current;
      const floor = Math.min(1, elapsed / MIN_FILL_MS);
      const target = Math.min(value, floor);
      const rate = target >= 0.95 ? 0.22 : 0.1;
      setShown((current) => {
        const next = current + (target - current) * rate;
        return next > 0.999 ? 1 : next;
      });
      if (elapsed > HARD_CAP_MS) setShown(1);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  useEffect(() => {
    if (shown < 0.999) return;
    setLeaving(true);
    const t = setTimeout(onDone, 260);
    return () => clearTimeout(t);
  }, [shown, onDone]);

  const pct = Math.round(shown * 100);
  /* Cells light in order as the bar fills, so the mark assembles rather than fading in.
     Ceil rather than round, so the very first cell lights as soon as anything has happened
     at all and the mark never sits completely unlit while the readout says work is underway. */
  const lit = shown > 0 ? Math.ceil(shown * runs.length) : 0;

  return (
    <div className={styles.screen} data-leaving={leaving} role="status" aria-live="polite">
      <div className={styles.stack}>
        <svg
          viewBox="0 0 12 12"
          width={72}
          height={72}
          fill="currentColor"
          shapeRendering="crispEdges"
          className={styles.mark}
          aria-hidden="true"
        >
          {runs.map((r, i) => (
            <rect
              key={`${r.x}-${r.y}-${r.w}`}
              className={styles.cell}
              data-on={i < lit}
              x={r.x}
              y={r.y}
              width={r.w}
              height={1}
            />
          ))}
        </svg>

        <div className={styles.readout}>
          <span>{label}</span>
          <span className={styles.pct}>{pct}%</span>
        </div>

        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>

        <p className={styles.note}>
          All data here is synthetic. Nothing in this demo is a real firm.
        </p>
      </div>
    </div>
  );
}
