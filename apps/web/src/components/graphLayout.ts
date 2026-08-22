/*
  Deterministic force layout for the decision genealogy.

  d3-force is deterministic by construction: its jiggle uses a fixed seed LCG rather than
  Math.random, and initial placement is a phyllotaxis spiral keyed on array index. So the
  same nodes in the same order produce byte identical coordinates on every machine, which
  is what makes the README screenshots and the video takes reproducible.

  Three things keep that true, and all three are easy to break by accident:

    1. Node array order IS the seed, because d3 assigns node.index from array position.
       Sort by id before building the simulation, or the layout shifts whenever a query
       returns rows in a different order.
    2. d3 mutates x, y, vx and vy in place. Feed it fresh objects every run.
    3. The LCG state is shared and stateful across forces, so every force has to be
       configured up front. Adding one mid run changes the draw sequence for all of them.

  Runs outside React and returns plain data. The component renders a static SVG from that
  and animates entrances on top, so there is no simulation ticking behind the UI and no
  StrictMode double invoke to reason about.
*/
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  type SimulationNodeDatum,
} from "d3-force";

export type GraphNode = {
  id: string;
  title: string;
  decisionType: string | null;
  riskFlag: boolean;
  authorMemberId: string;
  x: number;
  y: number;
};

export type GraphEdge = { source: string; target: string; relation: string };

type SimNode = SimulationNodeDatum & { id: string };

export function computeLayout(
  nodes: Omit<GraphNode, "x" | "y">[],
  edges: GraphEdge[],
  opts: { width: number; height: number; ticks?: number } = { width: 720, height: 420 },
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { width, height, ticks = 300 } = opts;

  /* Rule 1: sort first, and rule 2: fresh objects, both in one line. */
  const ordered = nodes.slice().sort((a, b) => a.id.localeCompare(b.id));
  const simNodes: SimNode[] = ordered.map((n) => ({ id: n.id }));
  const index = new Map(simNodes.map((n, i) => [n.id, i]));

  /* Edges that point at a node outside this subgraph would make forceLink throw. Drop
     them here rather than letting a strategy filter crash the page. */
  const simEdges = edges
    .filter((e) => index.has(e.source) && index.has(e.target))
    .map((e) => ({ source: index.get(e.source)!, target: index.get(e.target)!, relation: e.relation }));

  /*
    Repulsion scales down as the graph grows. A fixed charge that looks right for six
    nodes throws fifty of them clean out of the frame, because many body repulsion is
    pairwise and its total grows with the square of the node count.
  */
  const charge = -180 * Math.min(1, 12 / Math.max(1, simNodes.length));

  const sim = forceSimulation(simNodes)
    /* Rule 3: every force configured before the first tick. */
    .force("link", forceLink(simEdges).distance(46).strength(0.5))
    .force("charge", forceManyBody().strength(charge).distanceMax(220))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide(15).strength(0.9))
    .stop();

  sim.tick(ticks);

  /*
    Fit the settled layout into the frame.

    Tuning forces until a particular graph happens to land inside a particular viewBox is
    a losing game: the next strategy has a different node count and a different link
    density and it lands somewhere else. Measuring the bounding box and mapping it onto
    the frame makes the picture correct for any graph, and it stays deterministic because
    it is a pure function of coordinates that were themselves deterministic.

    Uniform scale on both axes, so the shape of the genealogy is never distorted to fill
    space. A stretched graph would misrepresent how far apart two decisions are.
  */
  const PAD = 26;
  const xs = simNodes.map((n) => n.x ?? 0);
  const ys = simNodes.map((n) => n.y ?? 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((width - PAD * 2) / spanX, (height - PAD * 2) / spanY, 1.6);
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;

  const laid: GraphNode[] = ordered.map((n, i) => ({
    ...n,
    x: (simNodes[i]!.x ?? 0) * scale + offsetX,
    y: (simNodes[i]!.y ?? 0) * scale + offsetY,
  }));

  return { nodes: laid, edges: edges.filter((e) => index.has(e.source) && index.has(e.target)) };
}
