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

  it("orders a successor strictly below its predecessor (top-to-bottom layout)", () => {
    // "b" must itself have an outgoing connection, or it is a terminal outcome — which the
    // dedicated "outcome column" tests below cover on their own, deliberately positioned level
    // with its source rather than below it. This test is specifically about the spine's vertical
    // ordering, so its fixture keeps every step a genuine, non-terminal unit of work.
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    );
    const result = computeLayout(workflow, BASE_OPTS);
    const a = result.nodes.find((n) => n.id === "a");
    const b = result.nodes.find((n) => n.id === "b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(b!.y).toBeGreaterThan(a!.y);
  });

  it("stacks a fan-out of sole-feed outcomes vertically in one outcome column, without overlap", () => {
    // "left"/"middle"/"right" all have zero outgoing connections, so each is a terminal outcome
    // fed only by "start" — the exact shape the outcome-column redesign targets: they share one
    // column (level with "start") and stack downward in declaration order instead of the old
    // per-rank side-by-side columns (which is what overflowed a 1440px canvas once one step had
    // three failure branches — see the "Also fix" case in upload-assets below).
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
    const left = result.nodes.find((n) => n.id === "left")!;
    const middle = result.nodes.find((n) => n.id === "middle")!;
    const right = result.nodes.find((n) => n.id === "right")!;
    // One shared outcome column, distinct from the spine.
    expect(left.x).toBe(middle.x);
    expect(middle.x).toBe(right.x);
    expect(left.x).not.toBe(start.x);
    // The first outcome anchors on its shared source's vertical centre (within half a pixel of
    // rounding when the two heights' parity differs); each later one stacks strictly below the
    // previous, in declaration order.
    expect(Math.abs(left.y - start.y)).toBeLessThanOrEqual(1);
    expect(middle.y).toBeGreaterThan(left.y);
    expect(right.y).toBeGreaterThan(middle.y);
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

  describe("the spine", () => {
    it("pins every step on a linear primary chain to one constant x, even when early failure/conditional connections skip ranks ahead to a shared step", () => {
      // Mirrors the shape that produced the "staircase": three decision steps each also fail
      // straight through to the same downstream step, which used to push every later rank
      // rightward. "save" itself continues on to "done" (an actual outcome pill) so it stays a
      // real pipeline step, not a terminal one — the spine-exclusion rule for terminal/outcome
      // steps is covered by its own dedicated test below instead of being conflated with this
      // one's anti-staircase assertion.
      const workflow = makeWorkflow(
        [
          makeStep("entry", { category: "entry" }),
          makeStep("validate"),
          makeStep("quota"),
          makeStep("scrape"),
          makeStep("understand"),
          makeStep("story"),
          makeStep("save"),
          makeStep("done"),
        ],
        [
          { from: "entry", to: "validate" },
          { from: "validate", to: "quota", type: "success" },
          { from: "validate", to: "save", type: "failure", label: "rejected" },
          { from: "quota", to: "scrape", type: "success" },
          { from: "quota", to: "save", type: "failure", label: "quota exceeded" },
          { from: "scrape", to: "understand", type: "success" },
          { from: "scrape", to: "save", type: "conditional", label: "scrape failed" },
          { from: "understand", to: "story" },
          { from: "story", to: "save" },
          { from: "save", to: "done", type: "success" },
        ],
      );
      const result = computeLayout(workflow, BASE_OPTS);
      const spineIds = ["entry", "validate", "quota", "scrape", "understand", "story", "save"];
      const byId = new Map(result.nodes.map((node) => [node.id, node] as const));
      const xs = new Set(spineIds.map((id) => byId.get(id)!.x));
      expect(xs.size).toBe(1);
      // "done" is the actual terminal step here, so it is the one that renders as an outcome
      // pill off the spine.
      expect(byId.get("done")!.x).not.toBe(byId.get("entry")!.x);
      assertNoOverlap(result.nodes);
    });

    it("keeps a step reached only via a failure/conditional connection off the spine, in a side column beside it", () => {
      const workflow = makeWorkflow(
        [
          makeStep("entry", { category: "entry" }),
          makeStep("validate"),
          makeStep("scan"),
          makeStep("persist"),
          makeStep("reject"),
        ],
        [
          { from: "entry", to: "validate" },
          { from: "validate", to: "scan", type: "success" },
          { from: "validate", to: "reject", type: "failure", label: "invalid" },
          { from: "scan", to: "persist", type: "conditional", label: "clean" },
          { from: "scan", to: "reject", type: "conditional", label: "flagged" },
        ],
      );
      const result = computeLayout(workflow, BASE_OPTS);
      const byId = new Map(result.nodes.map((node) => [node.id, node] as const));
      const spineX = byId.get("entry")!.x;
      expect(byId.get("validate")!.x).toBe(spineX);
      expect(byId.get("scan")!.x).toBe(spineX);
      // Neither "persist" nor "reject" is reachable from "entry" via an unbroken chain of
      // success/default connections, so both depart from the spine into the branch column.
      expect(byId.get("persist")!.x).not.toBe(spineX);
      expect(byId.get("reject")!.x).not.toBe(spineX);
      assertNoOverlap(result.nodes);
    });

    it("stacks two sole-feed outcomes sharing a source vertically in one column, instead of overlapping", () => {
      // "branchA"/"branchB" both terminate (no outgoing connections), so each is a terminal
      // outcome fed only by "start" — they belong in the shared outcome column, stacked one
      // below the other, not side-by-side in separate columns (the old per-rank branch-column
      // behaviour this test used to assert, before the outcome-column redesign).
      const workflow = makeWorkflow(
        [makeStep("start", { category: "entry" }), makeStep("main"), makeStep("branchA"), makeStep("branchB")],
        [
          { from: "start", to: "main" },
          { from: "start", to: "branchA", type: "failure", label: "a" },
          { from: "start", to: "branchB", type: "conditional", label: "b" },
        ],
      );
      const result = computeLayout(workflow, BASE_OPTS);
      const byId = new Map(result.nodes.map((node) => [node.id, node] as const));
      expect(byId.get("branchA")!.x).toBe(byId.get("branchB")!.x);
      expect(byId.get("branchA")!.y).not.toBe(byId.get("branchB")!.y);
      assertNoOverlap(result.nodes);
    });

    it("prefers the longest remaining primary chain at a fork with multiple primary successors", () => {
      // "longB" is a terminal step (nothing points out of it), so per the outcome-node rule
      // below it renders as an outcome pill and is deliberately excluded from the spine even
      // though it is reached by a primary connection — the walk still has to get there via
      // "longA", though, which is what this test actually verifies.
      const workflow = makeWorkflow(
        [
          makeStep("start", { category: "entry" }),
          makeStep("short"),
          makeStep("longA"),
          makeStep("longB"),
          makeStep("longC"),
        ],
        [
          { from: "start", to: "short" },
          { from: "start", to: "longA" },
          { from: "longA", to: "longB" },
          { from: "longB", to: "longC" },
        ],
      );
      const result = computeLayout(workflow, BASE_OPTS);
      const byId = new Map(result.nodes.map((node) => [node.id, node] as const));
      const spineX = byId.get("start")!.x;
      expect(byId.get("longA")!.x).toBe(spineX);
      expect(byId.get("longB")!.x).toBe(spineX);
      expect(byId.get("short")!.x).not.toBe(spineX);
      // "longC" is the actual terminal step in this version of the graph, and an outcome pill
      // never joins the spine (see "excludes a terminal step from the spine" below).
      expect(byId.get("longC")!.x).not.toBe(spineX);
      assertNoOverlap(result.nodes);
    });

    it("excludes a terminal step from the spine even when it is reached only by a primary connection", () => {
      const workflow = makeWorkflow(
        [makeStep("start", { category: "entry" }), makeStep("middle"), makeStep("end")],
        [
          { from: "start", to: "middle" },
          { from: "middle", to: "end", type: "success" },
        ],
      );
      const result = computeLayout(workflow, BASE_OPTS);
      const byId = new Map(result.nodes.map((node) => [node.id, node] as const));
      const spineX = byId.get("start")!.x;
      expect(byId.get("middle")!.x).toBe(spineX);
      expect(byId.get("end")!.x).not.toBe(spineX);
      assertNoOverlap(result.nodes);
    });
  });
});
