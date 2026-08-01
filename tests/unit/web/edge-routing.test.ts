import { describe, expect, it } from "vitest";
import type { Workflow, WorkflowStep } from "@schema/workflow";
import { buildOrthogonalPath, buildRetryLoopPath, computeEdgeRoutes, polylineIntersectsRect, type Point } from "@web/components/canvas/edgeRouting";
import { computeLayout, type LayoutNode } from "@web/components/canvas/layout";
import { computeBackEdgeIds } from "@web/components/canvas/graph";
import { estimateLabelChipWidth } from "@web/components/canvas/nodeContent";

function makeStep(id: string, overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return { id, name: `Step ${id}`, purpose: `Purpose of ${id}.`, ...overrides };
}

function makeWorkflow(steps: WorkflowStep[], connections: Workflow["connections"]): Workflow {
  return {
    schemaVersion: "0.1",
    id: "wf",
    name: "Workflow",
    purpose: "A test workflow.",
    steps,
    connections,
  };
}

const BASE_OPTS = { depth: "workflow" as const, expandedStepIds: {} };

/** Mirrors `generate-video`'s real shape (see `examples/motiona/.observatory/workflows`): three
 * decision/logic steps on the spine each also fail/branch straight through to one shared terminal
 * step several ranks below — the exact case that used to draw through the intervening cards. */
function generateVideoShapedWorkflow(): Workflow {
  return makeWorkflow(
    [
      makeStep("receive-request", { category: "entry" }),
      makeStep("validate-request", { category: "decision" }),
      makeStep("check-quota", { category: "decision" }),
      makeStep("scrape-website", { category: "logic" }),
      makeStep("understand-product", { category: "logic" }),
      makeStep("generate-story", { category: "logic" }),
      makeStep("save-result", { category: "output" }),
    ],
    [
      { from: "receive-request", to: "validate-request" },
      { from: "validate-request", to: "check-quota", type: "success" },
      { from: "validate-request", to: "save-result", type: "failure", label: "rejected" },
      { from: "check-quota", to: "scrape-website", type: "success" },
      { from: "check-quota", to: "save-result", type: "failure", label: "quota exceeded" },
      { from: "scrape-website", to: "understand-product", type: "success" },
      { from: "scrape-website", to: "save-result", type: "conditional", label: "scrape failed" },
      { from: "understand-product", to: "generate-story" },
      { from: "generate-story", to: "save-result" },
    ],
  );
}

/** Every branch edge's routed polyline (or, for an edge left unrouted, its direct two-point
 * path) must not intersect any node it doesn't itself connect to. The authoritative, non-eyeball
 * geometric proof the task asks for. */
function assertNoNodeIsClipped(
  nodes: LayoutNode[],
  points: Point[],
  sourceId: string,
  targetId: string,
  clearance = 2,
): void {
  for (const node of nodes) {
    if (node.id === sourceId || node.id === targetId) {
      continue;
    }
    const rect = { x: node.x, y: node.y, width: node.width, height: node.height };
    expect(
      polylineIntersectsRect(points, rect, clearance),
      `route for ${sourceId}->${targetId} clips node '${node.id}' within ${clearance}px`,
    ).toBe(false);
  }
}

/** Uses the same DOM-free width estimate as production routing/layout. */
function estimateLabelHalfWidthFlow(text: string): number {
  return estimateLabelChipWidth(text) / 2;
}

describe("computeEdgeRoutes", () => {
  it("is a pure function: identical input produces a deep-equal result", () => {
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const first = computeEdgeRoutes(layout.nodes, layout.edges);
    const second = computeEdgeRoutes(layout.nodes, layout.edges);
    expect(second).toEqual(first);
  });

  it("routes every branch edge that skips ranks around the spine, clipping no node — the generate-video shape", () => {
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);

    const branchEdgeIds = ["validate-request->save-result", "check-quota->save-result", "scrape-website->save-result"];
    const byNodeId = new Map(layout.nodes.map((n) => [n.id, n] as const));

    // Per-edge geometric report: waypoint count, lane x, the source/target anchors it bridges,
    // and its label anchor — the numeric proof that the route actually clears the intervening
    // spine cards, not an eyeballed screenshot. Asserted below rather than printed so it stays a
    // real (lint-clean) test assertion.
    const report: { label: string; waypoints: number; laneX: number; labelPoint: Point }[] = [];
    for (const layoutEdge of layout.edges) {
      const label = `${layoutEdge.source}->${layoutEdge.target}`;
      if (!branchEdgeIds.includes(label)) {
        continue;
      }
      const route = routes.get(layoutEdge.id);
      expect(route, `expected a sidecar route for ${label}`).toBeDefined();
      assertNoNodeIsClipped(layout.nodes, route!.points, layoutEdge.source, layoutEdge.target);
      const source = byNodeId.get(layoutEdge.source)!;
      const target = byNodeId.get(layoutEdge.target)!;
      // The lane must sit strictly to the right of the source (its horizontal turn-onto-lane
      // point) and clear of the target's own top edge with real margin, not merely touching it.
      expect(route!.points[2]!.x).toBeGreaterThan(source.x + source.width);
      expect(route!.points[3]!.y).toBeLessThan(target.y);
      report.push({ label, waypoints: route!.points.length, laneX: route!.points[2]!.x, labelPoint: route!.labelPoint });
    }
    expect(report).toHaveLength(3);
    // All three share one target (`save-result`), so they share one lane.
    expect(new Set(report.map((entry) => entry.laneX)).size).toBe(1);
    expect(report.every((entry) => entry.waypoints >= 4)).toBe(true);
  });

  it("merges branch edges that share a target into one lane", () => {
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);

    const laneXs = new Set<number>();
    for (const layoutEdge of layout.edges) {
      const isBranch = layoutEdge.connection.type === "failure" || layoutEdge.connection.type === "conditional";
      if (layoutEdge.target !== "save-result" || !isBranch) {
        continue;
      }
      const route = routes.get(layoutEdge.id);
      expect(route, `expected ${layoutEdge.source}->${layoutEdge.target} to be routed`).toBeDefined();
      laneXs.add(route!.points[2]!.x);
    }
    expect(laneXs.size).toBe(1);
  });

  it("keeps every branch label chip clear of the node column its lane runs beside (LANE_GAP regression guard)", () => {
    // The exact bug this guards: "quota exceeded" (check-quota->save-result) and "scrape failed"
    // (scrape-website->save-result) used to clip the neighbouring spine node when LANE_GAP was
    // smaller. This is the fast, browser-free companion to the Playwright screenshot coverage.
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);
    const graphMaxX = Math.max(...layout.nodes.map((node) => node.x + node.width));
    const labelledEdges = layout.edges.filter((edge) => edge.connection.label !== undefined);
    expect(labelledEdges.length).toBeGreaterThan(0);

    for (const layoutEdge of labelledEdges) {
      const route = routes.get(layoutEdge.id);
      expect(route, `expected a route for labelled edge ${layoutEdge.id}`).toBeDefined();
      const label = layoutEdge.connection.label!;
      const halfWidth = estimateLabelHalfWidthFlow(label);
      const labelLeftEdge = route!.labelPoint.x - halfWidth;
      expect(
        labelLeftEdge,
        `label "${label}" on ${layoutEdge.id} would clip the node column (left edge ${labelLeftEdge.toFixed(1)} vs graph max x ${graphMaxX})`,
      ).toBeGreaterThan(graphMaxX);
    }
  });

  it("gives shared-target sidecar branches distinct label y positions", () => {
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);

    const labelYs = Array.from(routes.values()).map((route) => route.labelPoint.y);
    const uniqueYs = new Set(labelYs);
    expect(uniqueYs.size).toBe(labelYs.length);
  });

  it("gives a lone sole-feed outcome a short direct hop, never the gutter-lane detour", () => {
    // "onlyBranch" is a terminal outcome fed only by "middle", so `layout.ts` anchors it level
    // with "middle" in the outcome column — exactly the shape `buildDirectHopRoute` exists for.
    // The route it gets back must be the short local hop (out of the source's right side, into
    // the target's left side), not the old bottom-to-top gutter-lane sidecar this same fixture
    // used to leave entirely unrouted.
    const workflow = makeWorkflow(
      [makeStep("start", { category: "entry" }), makeStep("middle"), makeStep("onlyBranch", { category: "output" })],
      [
        { from: "start", to: "middle" },
        { from: "middle", to: "onlyBranch", type: "failure", label: "rejected" },
      ],
    );
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);
    const edge = layout.edges.find((e) => e.source === "middle" && e.target === "onlyBranch")!;
    const route = routes.get(edge.id);
    const middle = layout.nodes.find((n) => n.id === "middle")!;
    const onlyBranch = layout.nodes.find((n) => n.id === "onlyBranch")!;

    expect(route).toBeDefined();
    // A straight local hop: exits the source's own right edge and enters the target's own left
    // edge, never a lane far out past the graph the way the sidecar gutter would.
    expect(route!.points[0]!.x).toBe(middle.x + middle.width);
    expect(route!.points[route!.points.length - 1]!.x).toBe(onlyBranch.x);
    for (const point of route!.points) {
      expect(point.x).toBeLessThanOrEqual(onlyBranch.x);
    }
    assertNoNodeIsClipped(layout.nodes, route!.points, edge.source, edge.target);
  });

  it("still routes a branch edge whose target is a sole-feed outcome stacked below a sibling in the same outcome column", () => {
    // "near" and "far" are both terminal outcomes fed only by "start", so both share one outcome
    // column: "near" anchors level with "start", and "far" stacks below it (see the layout tests'
    // "stacks a fan-out of sole-feed outcomes vertically" case). The edge into "far" must still
    // get a real route that clears "near" sitting directly above it in that same column, not a
    // path that clips it.
    const workflow = makeWorkflow(
      [
        makeStep("start", { category: "entry" }),
        makeStep("near", { category: "output" }),
        makeStep("far", { category: "output" }),
      ],
      [
        { from: "start", to: "near", type: "conditional", label: "near" },
        { from: "start", to: "far", type: "conditional", label: "far" },
      ],
    );
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);
    const farEdge = layout.edges.find((edge) => edge.target === "far")!;
    const nearEdge = layout.edges.find((edge) => edge.target === "near")!;
    const route = routes.get(farEdge.id);
    const nearRoute = routes.get(nearEdge.id);
    expect(route).toBeDefined();
    expect(nearRoute).toBeDefined();
    expect(route!.labelPoint.y).not.toBe(nearRoute!.labelPoint.y);
    assertNoNodeIsClipped(layout.nodes, route!.points, farEdge.source, farEdge.target);
  });

  it("routes the upload-assets shape (two branches from different ranks sharing one target) without clipping", () => {
    const workflow = makeWorkflow(
      [
        makeStep("receive-upload", { category: "entry" }),
        makeStep("validate-file", { category: "decision" }),
        makeStep("scan-for-malware", { category: "external" }),
        makeStep("persist-asset", { category: "output" }),
        makeStep("reject-upload", { category: "output" }),
      ],
      [
        { from: "receive-upload", to: "validate-file" },
        { from: "validate-file", to: "scan-for-malware", type: "success" },
        { from: "validate-file", to: "reject-upload", type: "failure", label: "invalid" },
        { from: "scan-for-malware", to: "persist-asset", type: "conditional", label: "clean" },
        { from: "scan-for-malware", to: "reject-upload", type: "conditional", label: "flagged" },
      ],
    );
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);

    for (const layoutEdge of layout.edges) {
      const route = routes.get(layoutEdge.id);
      if (route === undefined) {
        continue;
      }
      assertNoNodeIsClipped(layout.nodes, route.points, layoutEdge.source, layoutEdge.target);
    }
  });

  it("never routes a primary (success/default) edge — the spine stays a direct path", () => {
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);
    for (const layoutEdge of layout.edges) {
      const isPrimary = layoutEdge.connection.type === undefined || layoutEdge.connection.type === "success";
      if (isPrimary) {
        expect(routes.has(layoutEdge.id)).toBe(false);
      }
    }
  });

  it("produces only axis-aligned segments (every waypoint pair shares an x or a y)", () => {
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);
    for (const route of routes.values()) {
      for (let i = 0; i < route.points.length - 1; i += 1) {
        const a = route.points[i]!;
        const b = route.points[i + 1]!;
        expect(a.x === b.x || a.y === b.y, `segment ${i} of route '${route.id}' is diagonal`).toBe(true);
      }
    }
  });

  it("routes a non-self return edge clear of the ranks immediately before and after it", () => {
    const workflow = makeWorkflow(
      [makeStep("a", { category: "entry" }), makeStep("b"), makeStep("c"), makeStep("d")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "d" },
        { from: "c", to: "b", type: "conditional", label: "retry" },
      ],
    );
    const layout = computeLayout(workflow, BASE_OPTS);
    const edge = layout.edges.find((candidate) => candidate.source === "c" && candidate.target === "b")!;
    const route = computeEdgeRoutes(layout.nodes, layout.edges, computeBackEdgeIds(workflow)).get(edge.id)!;
    const target = layout.nodes.find((node) => node.id === "b")!;
    expect(route.points.at(-1)).toEqual({ x: target.x + target.width, y: target.y + target.height / 2 });
    // Fourteen flow-space pixels remains roughly twelve visible pixels at the fitted browser zoom
    // used by the review canvas. This guards against the subtler failure where a route does not
    // mathematically intersect a card but sits close enough to look hidden by its border.
    assertNoNodeIsClipped(layout.nodes, route.points, edge.source, edge.target, 14);
  });

  it("does not create a computeEdgeRoutes route for a self-loop", () => {
    const workflow = makeWorkflow([makeStep("a")], [{ from: "a", to: "a", type: "conditional", label: "retry" }]);
    const layout = computeLayout(workflow, BASE_OPTS);
    const edge = layout.edges[0]!;
    expect(computeEdgeRoutes(layout.nodes, layout.edges, computeBackEdgeIds(workflow)).has(edge.id)).toBe(false);
  });
});

describe("buildOrthogonalPath", () => {
  it("returns an empty string for fewer than two points", () => {
    expect(buildOrthogonalPath([], 8)).toBe("");
    expect(buildOrthogonalPath([{ x: 0, y: 0 }], 8)).toBe("");
  });

  it("draws a plain line for exactly two points", () => {
    expect(buildOrthogonalPath([{ x: 0, y: 0 }, { x: 10, y: 0 }], 8)).toBe("M0,0 L10,0");
  });

  it("rounds interior corners without moving the path's start or end point", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
    ];
    const d = buildOrthogonalPath(points, 8);
    expect(d.startsWith("M0,0")).toBe(true);
    expect(d.endsWith("L40,60")).toBe(true);
    // Two interior corners means two quadratic segments.
    expect(d.match(/Q/g)?.length).toBe(2);
  });

  it("clamps the corner radius to half of a short adjacent segment instead of overshooting it", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 2 }, // a very short segment
      { x: 40, y: 2 },
    ];
    // Should not throw and should still start/end at the original endpoints.
    const d = buildOrthogonalPath(points, 50);
    expect(d.startsWith("M0,0")).toBe(true);
    expect(d.endsWith("L40,2")).toBe(true);
  });

  it("collapses consecutive duplicate points instead of emitting a zero-length curve", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(buildOrthogonalPath(points, 8)).toBe("M0,0 L10,0");
  });
});

describe("buildRetryLoopPath", () => {
  const rect = { x: 100, y: 200, width: 300, height: 80 };

  it("departs and re-enters the same (right) edge of the node — never the top or bottom every other edge uses", () => {
    const loop = buildRetryLoopPath(rect);
    const rightX = rect.x + rect.width;
    // Both endpoints of the loop's cubic (`M<start> C<c1> <c2> <end>`) sit on the node's right
    // edge; the loop's own bulge (its control points) is the only part that goes further right.
    const match = /^M([\d.]+),([\d.]+) C([\d.]+),([\d.]+) ([\d.]+),([\d.]+) ([\d.]+),([\d.]+)$/.exec(loop.d);
    expect(match).not.toBeNull();
    const [, startX, , , , , , endX] = match!;
    expect(Number(startX)).toBe(rightX);
    expect(Number(endX)).toBe(rightX);
  });

  it("stays local to the node: its bulge is a small outset, not a long line across the canvas", () => {
    const loop = buildRetryLoopPath(rect);
    expect(loop.labelPoint.x).toBeGreaterThan(rect.x + rect.width);
    expect(loop.labelPoint.x).toBeLessThan(rect.x + rect.width + 100);
  });

  it("bulges out far enough to read as a meaningful loop, not card-border noise", () => {
    // A ~80px outset keeps the curl clear of the node's own right border at fit-view zoom; the
    // previous 46px outset merged with that border. The control points carry the bulge x; the
    // label sits just inside them on the outer curve.
    const loop = buildRetryLoopPath(rect);
    const rightX = rect.x + rect.width;
    const match = /^M[\d.]+,[\d.]+ C([\d.]+),[\d.]+ ([\d.]+),[\d.]+ [\d.]+,[\d.]+$/.exec(loop.d);
    expect(match).not.toBeNull();
    const [, c1X, c2X] = match!;
    expect(Number(c1X)).toBe(rightX + 80);
    expect(Number(c2X)).toBe(rightX + 80);
    expect(loop.labelPoint.x).toBe(rightX + 78);
  });

  it("re-enters above where it departs, so the loop reads as a compact upward curl", () => {
    const loop = buildRetryLoopPath(rect);
    const match = /^M[\d.]+,([\d.]+) C[\d.]+,[\d.]+ [\d.]+,[\d.]+ [\d.]+,([\d.]+)$/.exec(loop.d);
    const [, departY, enterY] = match!;
    expect(Number(enterY)).toBeLessThan(Number(departY));
  });
});
