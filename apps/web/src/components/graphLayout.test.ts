import { describe, it, expect } from "vitest";
import { computeLayout, type GraphEdge } from "./graphLayout";

const node = (id: string) => ({
  id, title: id, decisionType: "parameter_change", riskFlag: false, authorMemberId: "m1",
});

describe("genealogy layout", () => {
  const nodes = ["a", "b", "c", "d", "e", "f"].map(node);
  const edges: GraphEdge[] = [
    { source: "a", target: "b", relation: "supersedes" },
    { source: "b", target: "c", relation: "supersedes" },
    { source: "a", target: "d", relation: "informs" },
    { source: "e", target: "f", relation: "informs" },
  ];

  it("produces identical coordinates across runs", () => {
    const one = computeLayout(nodes, edges);
    const two = computeLayout(nodes, edges);
    expect(two.nodes.map((n) => [n.x, n.y])).toEqual(one.nodes.map((n) => [n.x, n.y]));
  });

  it("produces identical coordinates regardless of input order", () => {
    /* The assertion the screenshots depend on. A query returning rows in a different
       order must not move the graph, and the only reason it does not is the sort. */
    const forwards = computeLayout(nodes, edges);
    const backwards = computeLayout(nodes.slice().reverse(), edges);
    expect(backwards.nodes.map((n) => [n.id, n.x, n.y]))
      .toEqual(forwards.nodes.map((n) => [n.id, n.x, n.y]));
  });

  it("does not mutate the nodes it was given", () => {
    const input = nodes.map((n) => ({ ...n }));
    computeLayout(input, edges);
    for (const n of input) {
      expect(n).not.toHaveProperty("x");
      expect(n).not.toHaveProperty("vx");
    }
  });

  it("drops edges pointing outside the subgraph instead of throwing", () => {
    const dangling: GraphEdge[] = [...edges, { source: "a", target: "ghost", relation: "informs" }];
    const out = computeLayout(nodes, dangling);
    expect(out.edges).toHaveLength(edges.length);
  });

  it("produces finite coordinates for an isolated node", () => {
    const out = computeLayout([node("lonely")], []);
    expect(Number.isFinite(out.nodes[0]!.x)).toBe(true);
    expect(Number.isFinite(out.nodes[0]!.y)).toBe(true);
  });

  it("keeps every node inside the frame, at any node count", () => {
    /* The assertion that matters most in practice. Force layouts explode as they grow,
       and a graph whose nodes are outside the viewBox renders as an empty pane with a
       couple of stray lines in it. */
    for (const count of [1, 6, 25, 60, 150]) {
      const many = Array.from({ length: count }, (_, i) => node(`n${i}`));
      const chain: GraphEdge[] = many
        .slice(1)
        .map((n, i) => ({ source: many[i]!.id, target: n.id, relation: "supersedes" }));
      const out = computeLayout(many, chain, { width: 760, height: 420 });
      for (const n of out.nodes) {
        expect(n.x, `${count} nodes, ${n.id}.x`).toBeGreaterThanOrEqual(0);
        expect(n.x, `${count} nodes, ${n.id}.x`).toBeLessThanOrEqual(760);
        expect(n.y, `${count} nodes, ${n.id}.y`).toBeGreaterThanOrEqual(0);
        expect(n.y, `${count} nodes, ${n.id}.y`).toBeLessThanOrEqual(420);
      }
    }
  });

  it("does not distort the graph to fill the frame", () => {
    /* Uniform scale only. Stretching one axis would make two decisions look further
       apart than the layout actually placed them. */
    const many = Array.from({ length: 20 }, (_, i) => node(`n${i}`));
    const out = computeLayout(many, [], { width: 760, height: 420 });
    const xs = out.nodes.map((n) => n.x);
    const ys = out.nodes.map((n) => n.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    /* A phyllotaxis spiral is roughly circular, so the two spans should be close. If the
       fit were stretching, the wider axis would be dramatically larger. */
    expect(spanX / spanY).toBeGreaterThan(0.6);
    expect(spanX / spanY).toBeLessThan(1.7);
  });

  it("spreads nodes out rather than stacking them", () => {
    const out = computeLayout(nodes, edges);
    const xs = new Set(out.nodes.map((n) => Math.round(n.x)));
    expect(xs.size).toBeGreaterThan(1);
  });
});
