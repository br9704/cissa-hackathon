/*
  The agent's face.

  Everything in this product that a model did is labelled, and until now that labelling was
  words: "drafted by model", "answered by". Words are easy to skim past. A face is not, and
  the point of the labelling is that a reader should never be in any doubt about whether a
  human or a machine wrote the sentence they are reading.

  Deliberately simple: a five by five pixel face on the same grid system as the icons and the
  mark, with three states and no personality beyond them. A cartoon mascot would undercut a
  product whose entire argument is that its records are evidence.

    idle      the model is available and doing nothing
    thinking  a request is in flight, and the eyes scan
    spoke     the model produced the thing next to this face

  The scan is two cells moving inside a fixed head, which is the cheapest possible animation
  that reads as attention rather than as decoration, and it collapses to a static frame under
  reduced motion.
*/
import styles from "./PixelAgent.module.css";

export type AgentState = "idle" | "thinking" | "spoke" | "offline";

/* Head outline, eight by eight. The eyes are drawn separately so they can move. */
const HEAD = [
  ".######.",
  "########",
  "########",
  "########",
  "########",
  ".######.",
  "..#..#..",
  "..#..#..",
];

type Run = { x: number; y: number; w: number };

function runs(grid: string[]): Run[] {
  const out: Run[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === "#") {
        let w = 0;
        while (x + w < row.length && row[x + w] === "#") w++;
        out.push({ x, y, w });
        x += w;
      } else x++;
    }
  });
  return out;
}

const HEAD_RUNS = runs(HEAD);

export function PixelAgent({
  state = "idle",
  size = 20,
  label,
}: {
  state?: AgentState;
  size?: number;
  label?: string;
}) {
  return (
    <span
      className={styles.wrap}
      data-state={state}
      title={label ?? STATE_LABEL[state]}
      aria-label={label ?? STATE_LABEL[state]}
      role="img"
    >
      <svg viewBox="0 0 8 8" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
        <g className={styles.head} fill="currentColor">
          {HEAD_RUNS.map((r) => (
            <rect key={`${r.x}-${r.y}-${r.w}`} x={r.x} y={r.y} width={r.w} height={1} />
          ))}
        </g>
        {/* The eyes are cut out of the head rather than drawn on top, so the face reads at
            20px where an outline plus pupils would turn to mush. */}
        <g className={styles.eyes}>
          <rect x={2} y={2} width={1} height={2} />
          <rect x={5} y={2} width={1} height={2} />
        </g>
      </svg>
    </span>
  );
}

const STATE_LABEL: Record<AgentState, string> = {
  idle: "The on-prem model is available",
  thinking: "The model is working on this",
  spoke: "A model wrote this, and a person has not approved it yet",
  offline: "No model is reachable, so this came from the record alone",
};
