import { describe, expect, it } from "vitest";
import type { Workflow, WorkflowStep } from "@schema/workflow";
import { computeLayout } from "@web/components/canvas/layout";

function makeStep(id: string, overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return { id, name: `Step ${id}`, purpose: `Purpose of ${id}.`, ...overrides };
}

function makeWorkflow(steps: WorkflowStep[], connections: Workflow["connections"] = []): Workflow {
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

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  const separatedX = a.x + a.width <= b.x || b.x + b.width <= a.x;
  const separatedY = a.y + a.height <= b.y || b.y + b.height <= a.y;
  return !separatedX && !separatedY;
}

function assertNoOverlap(nodes: { id: string; x: number; y: number; width: number; height: number }[]): void {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (a === undefined || b === undefined) continue;
      expect(overlaps(a, b), `${a.id} and ${b.id} overlap`).toBe(false);
    }
  }
}

describe("computeLayout", () => {
  it("is a pure function: identical input produces a deep-equal result", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    );
    const first = computeLayout(workflow, BASE_OPTS);
    const second = computeLayout(workflow, BASE_OPTS);
    expect(second).toEqual(first);
  });

  it("lays out a single-step workflow without error", () => {
    const workflow = makeWorkflow([makeStep("only")]);
    const result = computeLayout(workflow, BASE_OPTS);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.nodes[0]?.width).toBeGreaterThan(0);
    expect(result.nodes[0]?.height).toBeGreaterThan(0);
  });

  it("lays out a workflow with zero connections in a row (shared y, increasing x)", () => {
    const workflow = makeWorkflow([makeStep("a"), makeStep("b"), makeStep("c")]);
    const result = computeLayout(workflow, BASE_OPTS);
    const [a, b, c] = result.nodes;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
    expect(a?.y).toBe(b?.y);
    expect(b?.y).toBe(c?.y);
    expect(a && b ? a.x < b.x : false).toBe(true);
    expect(b && c ? b.x < c.x : false).toBe(true);
    assertNoOverlap(result.nodes);
  });

  it("orders a successor strictly to the right of its predecessor (left-to-right layout)", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b")],
      [{ from: "a", to: "b" }],
    );
    const result = computeLayout(workflow, BASE_OPTS);
    const a = result.nodes.find((n) => n.id === "a");
    const b = result.nodes.find((n) => n.id === "b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(b!.x).toBeGreaterThan(a!.x);
  });

  it("handles branching (one step fanning out to three) without overlap", () => {
    const workflow = makeWorkflow(
      [makeStep("start"), makeStep("left"), makeStep("middle"), makeStep("right")],
      [
        { from: "start", to: "left" },
        { from: "start", to: "middle" },
        { from: "start", to: "right" },
      ],
    );
    const result = computeLayout(workflow, BASE_OPTS);
    expect(result.nodes).toHaveLength(4);
    assertNoOverlap(result.nodes);
    const start = result.nodes.find((n) => n.id === "start")!;
    for (const id of ["left", "middle", "right"]) {
      const node = result.nodes.find((n) => n.id === id)!;
      expect(node.x).toBeGreaterThan(start.x);
    }
  });

  it("does not hang or throw on a cycle (a retry loop back to an earlier step)", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a", type: "conditional", label: "retry" },
      ],
    );
    const start = Date.now();
    const result = computeLayout(workflow, BASE_OPTS);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(result.nodes).toHaveLength(3);
    assertNoOverlap(result.nodes);
  });

  it("places a disconnected step without overlapping the connected graph", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("lonely")],
      [{ from: "a", to: "b" }],
    );
    const result = computeLayout(workflow, BASE_OPTS);
    expect(result.nodes).toHaveLength(3);
    assertNoOverlap(result.nodes);
  });

  it("grows node height as depth increases when a step has files and symbols", () => {
    const step = makeStep("a", {
      sources: [
        { file: "src/one.ts", symbol: "one" },
        { file: "src/two.ts", symbol: "two" },
      ],
    });
    const workflow = makeWorkflow([step]);
    const workflowHeight = computeLayout(workflow, { depth: "workflow", expandedStepIds: {} }).nodes[0]!.height;
    const modulesHeight = computeLayout(workflow, { depth: "modules", expandedStepIds: {} }).nodes[0]!.height;
    const symbolsHeight = computeLayout(workflow, { depth: "symbols", expandedStepIds: {} }).nodes[0]!.height;
    expect(modulesHeight).toBeGreaterThan(workflowHeight);
    expect(symbolsHeight).toBeGreaterThan(modulesHeight);
  });

  it("grows a single step's height when only it is expanded, leaving others unchanged", () => {
    const detailed = makeStep("a", { sources: [{ file: "src/one.ts", symbol: "one" }] });
    const plain = makeStep("b", { sources: [{ file: "src/two.ts", symbol: "two" }] });
    const workflow = makeWorkflow([detailed, plain]);

    const collapsed = computeLayout(workflow, { depth: "workflow", expandedStepIds: {} });
    const expanded = computeLayout(workflow, { depth: "workflow", expandedStepIds: { a: true } });

    const collapsedA = collapsed.nodes.find((n) => n.id === "a")!;
    const expandedA = expanded.nodes.find((n) => n.id === "a")!;
    const collapsedB = collapsed.nodes.find((n) => n.id === "b")!;
    const expandedB = expanded.nodes.find((n) => n.id === "b")!;

    expect(expandedA.height).toBeGreaterThan(collapsedA.height);
    expect(expandedB.height).toBe(collapsedB.height);
  });

  it("accepts expandedStepIds as a ReadonlySet as well as a Record", () => {
    const step = makeStep("a", { sources: [{ file: "src/one.ts", symbol: "one" }] });
    const workflow = makeWorkflow([step]);
    const viaRecord = computeLayout(workflow, { depth: "workflow", expandedStepIds: { a: true } });
    const viaSet = computeLayout(workflow, { depth: "workflow", expandedStepIds: new Set(["a"]) });
    expect(viaSet).toEqual(viaRecord);
  });
});
