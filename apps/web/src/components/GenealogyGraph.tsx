import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./GenealogyGraph.module.css";
import { computeLayout, type GraphEdge, type GraphNode } from "./graphLayout";

const WIDTH = 1080;
const HEIGHT = 440;

/*
  Node radius shrinks as the graph grows. A 9px node reads well for a single strategy's
  fifty decisions and turns the whole firm's two hundred into a solid mass of overlapping
  circles. The ring around a risk flagged node has to stay legible at the small end, so
  it never goes below 4.
*/
function radiusFor(count: number): number {
  if (count <= 40) return 9;
  if (count <= 90) return 7;
  if (count <= 160) return 5.5;
  return 4.5;
}

export function GenealogyGraph({
  nodes,
  edges,
  /* Ids to hold at full strength. Everything else desaturates. This is the departure
     simulation: it does not recolour the graph, it removes emphasis from everything that
     is not at risk, which reads as loss rather than as decoration. */
  highlighted,
  /*
    Which nodes exist yet.

    The replay needs the graph to ASSEMBLE, not to relayout: a force simulation rerun at
    every scrubber position would have nodes swimming around as their neighbours appear,
    which reads as chaos rather than as memory accumulating. So the layout is computed
    once over the full graph and this filters what is drawn. Every node lands in its
    final position the moment it appears and never moves again.
  */
  visible,
  selectedId,
  onSelect,
}: {
  nodes: Omit<GraphNode, "x" | "y">[];
  edges: GraphEdge[];
  highlighted?: Set<string> | null;
  visible?: Set<string> | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const reduced = useReducedMotion();

  /*
    useMemo is safe here precisely because computeLayout is pure and mutates nothing:
    StrictMode's double invoke produces the same answer twice rather than a graph that
    settles differently on the second pass.
  */
  const layout = useMemo(
    () => computeLayout(nodes, edges, { width: WIDTH, height: HEIGHT }),
    [nodes, edges],
  );

  const positions = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout],
  );

  const isDim = (id: string) => Boolean(highlighted) && !highlighted!.has(id);
  const isVisible = (id: string) => !visible || visible.has(id);
  const R = radiusFor(layout.nodes.length);

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Decision genealogy, ${layout.nodes.length} decisions and ${layout.edges.length} links`}
      >
        <g>
          {layout.edges.map((e, i) => {
            const a = positions.get(e.source);
            const b = positions.get(e.target);
            if (!a || !b) return null;
            if (!isVisible(e.source) || !isVisible(e.target)) return null;
            const dim = isDim(e.source) || isDim(e.target);
            return (
              <motion.line
                key={`${e.source}-${e.target}-${e.relation}`}
                className={`${styles.edge} ${e.relation === "supersedes" ? styles.edgeSupersedes : ""} ${dim ? styles.dimmed : ""}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                strokeDasharray={e.relation === "informs" ? "3 3" : undefined}
                initial={reduced ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
                animate={reduced ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
                transition={{
                  duration: reduced ? 0.1 : 0.24,
                  delay: reduced ? 0 : Math.min(i * 0.004, 0.4),
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            );
          })}
        </g>

        <g>
          {layout.nodes.map((n, i) => {
            if (!isVisible(n.id)) return null;
            const dim = isDim(n.id);
            return (
              /*
                Two nested groups, and the nesting is load bearing.

                The outer group owns the position and is a plain SVG element. The inner
                one owns the entrance and is the motion element. They have to be separate
                because motion writes the `transform` attribute itself to express scale,
                so a translate set on the same element is silently overwritten and every
                node renders stacked at the origin. That failure looks like the nodes
                have not rendered at all, which is a long way from the actual cause.
              */
              <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                <motion.g
                  className={`${styles.node} ${selectedId === n.id ? styles.nodeSelected : ""} ${dim ? styles.dimmed : ""}`}
                  onClick={() => onSelect?.(n.id)}
                  /*
                    Scale and opacity, never a blur. Animating into and out of a blur is
                    called out as a thing to avoid for reduced motion, and it is also the
                    exact move the glass performance rule forbids elsewhere in the app.
                  */
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: reduced ? 0.12 : 0.24,
                    delay: reduced ? 0 : Math.min(i * 0.006, 0.5),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {n.riskFlag ? (
                    <circle className={styles.riskRing} cx={0} cy={0} r={R + 4} />
                  ) : null}
                  <circle className={styles.nodeBody} cx={0} cy={0} r={R} />
                  <title>{n.title}</title>
                </motion.g>
              </g>
            );
          })}
        </g>
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatch} /> decision
        </span>
        <span className={styles.legendItem}>
          <svg width="20" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="19" y2="5" className={styles.edgeSupersedes} strokeWidth="1.2" />
          </svg>
          supersedes
        </span>
        <span className={styles.legendItem}>
          <svg width="20" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="19" y2="5" className={styles.edge} strokeWidth="1.2" strokeDasharray="3 3" />
          </svg>
          informs
        </span>
        <span className={styles.legendItem}>
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" className={styles.riskRing} />
          </svg>
          risk flagged
        </span>
      </div>
    </div>
  );
}
