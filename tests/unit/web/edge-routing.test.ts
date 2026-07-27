import { describe, expect, it } from "vitest";
import type { Workflow, WorkflowStep } from "@schema/workflow";
import { buildOrthogonalPath, computeEdgeRoutes, polylineIntersectsRect, type Point } from "@web/components/canvas/edgeRouting";
import { computeLayout, type LayoutNode } from "@web/components/canvas/layout";

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
function assertNoNodeIsClipped(nodes: LayoutNode[], points: Point[], sourceId: string, targetId: string): void {
  for (const node of nodes) {
    if (node.id === sourceId || node.id === targetId) {
      continue;
    }
    const rect = { x: node.x, y: node.y, width: node.width, height: node.height };
    expect(polylineIntersectsRect(points, rect), `route for ${sourceId}->${targetId} clips node '${node.id}'`).toBe(false);
  }
}

/**
 * A conservative estimate of a rendered label chip's flow-space half-width, fitted against real
 * `getBoundingClientRect()` measurements taken from `examples/motiona`'s `generate-video`
 * workflow in a live browser (`dist/shots/capture.mjs`): "rejected" (8 chars) measured ~69.6
 * flow units wide, "quota exceeded" (15 chars) ~108.3, "scrape failed" (13 chars) ~101.8. Fit
 * as `width = perChar * chars + overhead` and rounded up (larger than the real slope/intercept)
 * so this stays a safe upper bound rather than a tight one — the regression this guards against
 * is `LANE_GAP` shrinking back below what a real label chip needs, not a precise pixel replica
 * of `WorkflowEdge.module.css`.
 */
function estimateLabelHalfWidthFlow(text: string): number {
  const PER_CHAR = 6;
  const OVERHEAD = 28;
  return (PER_CHAR * text.length + OVERHEAD) / 2;
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
    // Every waypoint list is the same fixed 6-point sidecar shape.
    expect(report.every((entry) => entry.waypoints === 6)).toBe(true);
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
    // (scrape-website->save-result) both used to clip the neighbouring spine node by a few
    // pixels when LANE_GAP was 40 — confirmed by rendering this real workflow shape in a browser
    // and reading back real label/node rects (dist/shots/capture.mjs). This is the fast,
    // browser-free version of that same proof: for every routed label, its estimated chip must
    // sit fully clear (to the right) of the graph's rightmost node edge.
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

  it("gives concurrent branches sharing a lane distinct, non-colliding label points", () => {
    const workflow = generateVideoShapedWorkflow();
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);

    const labelYs = Array.from(routes.values()).map((route) => route.labelPoint.y);
    const uniqueYs = new Set(labelYs);
    expect(uniqueYs.size).toBe(labelYs.length);
  });

  it("leaves a lone branch with a clear direct path unrouted (no gratuitous detour)", () => {
    // "onlyBranch" is the sole occupant of its rank — nothing shares its column, and the sole
    // node above it in the corridor ("start") is a full rank further away with a real gap, not a
    // touched boundary — so a direct smoothstep path genuinely can't clip anything here.
    const workflow = makeWorkflow(
      [makeStep("start", { category: "entry" }), makeStep("middle"), makeStep("onlyBranch")],
      [
        { from: "start", to: "middle" },
        { from: "middle", to: "onlyBranch", type: "failure", label: "rejected" },
      ],
    );
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);
    expect(routes.size).toBe(0);
  });

  it("still routes a branch edge whose target shares a rank with a nearer-column sibling, even though the direct path's endpoints only touch that sibling's boundary", () => {
    // Two concurrent outcomes of one fan-out landing in different branch columns (the farther one
    // reached over the nearer one's rank) — confirmed by rendering this exact shape in a real
    // browser that React Flow's own rounded-corner `getSmoothStepPath` clips the nearer column's
    // card here if left un-rerouted, even though the two nodes only share a rank boundary rather
    // than genuinely overlapping in the naive sense.
    const workflow = makeWorkflow(
      [makeStep("start", { category: "entry" }), makeStep("near"), makeStep("far")],
      [
        { from: "start", to: "near", type: "conditional", label: "near" },
        { from: "start", to: "far", type: "conditional", label: "far" },
      ],
    );
    const layout = computeLayout(workflow, BASE_OPTS);
    const routes = computeEdgeRoutes(layout.nodes, layout.edges);
    const farEdge = layout.edges.find((edge) => edge.target === "far")!;
    const route = routes.get(farEdge.id);
    expect(route).toBeDefined();
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
