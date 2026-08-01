import { describe, expect, it } from "vitest";
import type { Workflow, WorkflowStep } from "@schema/workflow";
import { computeDirectLabelPoint, connectionLabelText, type Point } from "@web/components/canvas/edgeLabel";
import { computeEdgeRoutes } from "@web/components/canvas/edgeRouting";
import { computeLayout, type LayoutNode } from "@web/components/canvas/layout";
import { computeBackEdgeIds } from "@web/components/canvas/graph";
import { EDGE_LABEL_CHIP_HEIGHT, estimateLabelChipWidth } from "@web/components/canvas/nodeContent";

function makeStep(id: string, overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return { id, name: `Step ${id}`, purpose: `Purpose of ${id}.`, ...overrides };
}

function makeWorkflow(steps: WorkflowStep[], connections: Workflow["connections"]): Workflow {
  return { schemaVersion: "0.1", id: "wf", name: "Workflow", purpose: "A test workflow.", steps, connections };
}

const BASE_OPTS = { depth: "workflow" as const, expandedStepIds: {} };

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function labelRect(centre: Point, text: string): Rect {
  const width = estimateLabelChipWidth(text);
  return { x: centre.x - width / 2, y: centre.y - EDGE_LABEL_CHIP_HEIGHT / 2, width, height: EDGE_LABEL_CHIP_HEIGHT };
}

function nodeRect(node: LayoutNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

/** Every labelled connection's estimated chip rect (routed edges use their own precomputed
 * `labelPoint`; direct edges use `computeDirectLabelPoint`, the same formula `WorkflowEdge.tsx`
 * renders with) must not overlap any node box — the geometric guarantee behind the "clean" label
 * that used to sit on top of `persist-asset`'s own border. */
function assertNoLabelOverlapsAnyNode(workflow: Workflow): void {
  const layout = computeLayout(workflow, BASE_OPTS);
  const routes = computeEdgeRoutes(layout.nodes, layout.edges, computeBackEdgeIds(workflow));
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node] as const));

  for (const edge of layout.edges) {
    const text = connectionLabelText(edge.connection);
    if (text === undefined) {
      continue;
    }
    const route = routes.get(edge.id);
    let centre: Point;
    if (route !== undefined) {
      centre = route.labelPoint;
    } else {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (source === undefined || target === undefined) {
        continue;
      }
      centre = computeDirectLabelPoint(source, target);
    }
    const rect = labelRect(centre, text);
    for (const node of layout.nodes) {
      expect(rectsOverlap(rect, nodeRect(node)), `label "${text}" (${edge.id}) overlaps node '${node.id}'`).toBe(false);
    }
  }
}

describe("edge label / node overlap", () => {
  it("never overlaps a node box for a labelled primary edge between adjacent ranks (the upload-assets 'clean' shape)", () => {
    // Mirrors `examples/motiona/.hq/workflows/upload-assets.json`'s exact shape: a
    // labelled *success* connection ("clean") straight from one spine step to the very next —
    // the case `LAYOUT_RANK_SEP` alone (18px) was too narrow to hold the label chip for.
    const workflow = makeWorkflow(
      [
        makeStep("receive-upload", { category: "entry" }),
        makeStep("validate-file", { category: "decision" }),
        makeStep("scan-for-malware", { category: "external" }),
        makeStep("persist-asset", { category: "output" }),
        makeStep("outcome-created", { category: "output" }),
      ],
      [
        { from: "receive-upload", to: "validate-file" },
        { from: "validate-file", to: "scan-for-malware", type: "success" },
        { from: "scan-for-malware", to: "persist-asset", type: "success", label: "clean" },
        { from: "persist-asset", to: "outcome-created", type: "success" },
      ],
    );
    assertNoLabelOverlapsAnyNode(workflow);
  });

  it("never overlaps a node box across a range of labelled connections, including short and long labels", () => {
    // "c" carries its own further outgoing connection, or a zero-out-degree step is a terminal
    // outcome (routed as a sideways hop with its own, separately-sized label geometry) rather
    // than the next plain spine rank this test means to exercise.
    const workflow = makeWorkflow(
      [
        makeStep("entry", { category: "entry" }),
        makeStep("a"),
        makeStep("b"),
        makeStep("c"),
        makeStep("d"),
        makeStep("outcome-fail", { category: "output" }),
      ],
      [
        { from: "entry", to: "a" },
        { from: "a", to: "b", type: "success", label: "ok" },
        { from: "b", to: "c", type: "success", label: "quota not exceeded" },
        { from: "b", to: "outcome-fail", type: "failure", label: "quota exceeded" },
        { from: "c", to: "d" },
      ],
    );
    assertNoLabelOverlapsAnyNode(workflow);
  });

  it("widens only the affected rank gap, leaving an unlabelled gap at the default LAYOUT_RANK_SEP", () => {
    // "b" needs its own outgoing connection, or a zero-out-degree step is a terminal outcome
    // (anchored beside its source, not below it) rather than the next spine rank this test means
    // to measure the gap above.
    const workflow = makeWorkflow(
      [makeStep("entry", { category: "entry" }), makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "entry", to: "a" }, // unlabelled — should stay at the default gap
        { from: "a", to: "b", type: "success", label: "clean" }, // labelled — should widen
        { from: "b", to: "c" },
      ],
    );
    const layout = computeLayout(workflow, BASE_OPTS);
    const byId = new Map(layout.nodes.map((node) => [node.id, node] as const));
    const entry = byId.get("entry")!;
    const a = byId.get("a")!;
    const b = byId.get("b")!;

    const unlabelledGap = a.y - (entry.y + entry.height);
    const labelledGap = b.y - (a.y + a.height);
    expect(labelledGap).toBeGreaterThan(unlabelledGap);
  });
});
