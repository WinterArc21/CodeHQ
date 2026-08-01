import { describe, expect, it } from "vitest";
import type { Workflow, WorkflowStep } from "@schema/workflow";
import { computeArrowNavigation, computeBackEdgeIds, computeIncomingTypes, computeOutcomeStepIds, computeOutDegree, computeTracePath } from "@web/components/canvas/graph";

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

describe("computeOutDegree", () => {
  it("counts only valid outgoing connections, defaulting every step to zero", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
      ],
    );
    const outDegree = computeOutDegree(workflow);
    expect(outDegree.get("a")).toBe(2);
    expect(outDegree.get("b")).toBe(0);
    expect(outDegree.get("c")).toBe(0);
  });

  it("ignores a connection pointing at a step id that doesn't exist", () => {
    const workflow = makeWorkflow([makeStep("a")], [{ from: "a", to: "missing" }]);
    expect(computeOutDegree(workflow).get("a")).toBe(0);
  });
});

describe("computeOutcomeStepIds", () => {
  it("requires output category, a valid incoming connection, and terminal shape", () => {
    const workflow = makeWorkflow(
      [makeStep("entry"), makeStep("out", { category: "output" }), makeStep("terminal"), makeStep("isolated", { category: "output" }), makeStep("continuing", { category: "output" })],
      [{ from: "entry", to: "out" }, { from: "entry", to: "terminal" }, { from: "entry", to: "continuing" }, { from: "continuing", to: "out" }, { from: "missing", to: "isolated" }],
    );
    expect(computeOutcomeStepIds(workflow)).toEqual(new Set(["out"]));
  });
});

describe("computeArrowNavigation", () => {
  const pipeline = makeWorkflow(
    [makeStep("entry"), makeStep("guard"), makeStep("save"), makeStep("bad", { category: "output" }), makeStep("ok", { category: "output" })],
    [{ from: "entry", to: "guard" }, { from: "guard", to: "save" }, { from: "guard", to: "bad", type: "failure" }, { from: "save", to: "ok" }],
  );

  it.each([
    ["guard", "right", "bad"],
    ["bad", "left", "guard"],
    ["guard", "down", "save"],
  ] as const)("maps %s Arrow%s to %s", (from, direction, to) => {
    expect(computeArrowNavigation(pipeline, from)[direction]).toBe(to);
  });

  it("moves between fan-out sibling lanes", () => {
    const workflow = makeWorkflow([makeStep("root"), makeStep("a"), makeStep("b")], [{ from: "root", to: "a" }, { from: "root", to: "b" }]);
    expect(computeArrowNavigation(workflow, "a").right).toBe("b");
    expect(computeArrowNavigation(workflow, "b").left).toBe("a");
  });

  it("moves vertically through outcomes sharing a sole source", () => {
    const workflow = makeWorkflow([makeStep("source"), makeStep("one", { category: "output" }), makeStep("two", { category: "output" })], [{ from: "source", to: "one", type: "failure" }, { from: "source", to: "two", type: "failure" }]);
    expect(computeArrowNavigation(workflow, "one").down).toBe("two");
    expect(computeArrowNavigation(workflow, "two").up).toBe("one");
  });

  it("makes every node in a representative graph arrow-reachable from entry", () => {
    const seen = new Set(["entry"]);
    const queue = ["entry"];
    while (queue.length) {
      const navigation = computeArrowNavigation(pipeline, queue.shift()!);
      for (const next of Object.values(navigation)) if (next && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
    expect(seen).toEqual(new Set(pipeline.steps.map((step) => step.id)));
  });
});

describe("computeIncomingTypes", () => {
  it("collects the type of every valid connection landing on a step", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("outcome")],
      [
        { from: "a", to: "outcome", type: "failure" },
        { from: "b", to: "outcome", type: "failure" },
      ],
    );
    expect(computeIncomingTypes(workflow).get("outcome")).toEqual(["failure", "failure"]);
  });

  it("returns undefined (no entry) for a step nothing points at", () => {
    const workflow = makeWorkflow([makeStep("a")]);
    expect(computeIncomingTypes(workflow).get("a")).toBeUndefined();
  });
});

describe("computeBackEdgeIds", () => {
  it("flags a self-loop (a step retrying itself) as a back edge", () => {
    const workflow = makeWorkflow([makeStep("call")], [{ from: "call", to: "call", label: "retry" }]);
    const backEdges = computeBackEdgeIds(workflow);
    expect(backEdges.has("call->call#0")).toBe(true);
  });

  it("flags a connection back to an already-visited ancestor as a back edge", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a", label: "retry" },
      ],
    );
    const backEdges = computeBackEdgeIds(workflow);
    expect(backEdges.has("c->a#2")).toBe(true);
    expect(backEdges.has("a->b#0")).toBe(false);
    expect(backEdges.has("b->c#1")).toBe(false);
  });

  it("does not flag a normal forward DAG's connections", () => {
    const workflow = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "c" },
      ],
    );
    expect(computeBackEdgeIds(workflow).size).toBe(0);
  });

  it("respects an explicit connection id instead of the positional fallback", () => {
    const workflow = makeWorkflow([makeStep("call")], [{ id: "retry-edge", from: "call", to: "call" }]);
    expect(computeBackEdgeIds(workflow).has("retry-edge")).toBe(true);
  });
});

describe("computeTracePath", () => {
  // a -> b -> c -> d, with an early branch a -> e (dead end)
  const workflow = makeWorkflow(
    [makeStep("a"), makeStep("b"), makeStep("c"), makeStep("d"), makeStep("e")],
    [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "d" },
      { from: "a", to: "e", type: "failure" },
    ],
  );

  it("includes the anchor itself even with no connections at all", () => {
    const trace = computeTracePath(workflow, "b");
    expect(trace.stepIds.has("b")).toBe(true);
  });

  it("includes only the anchor's direct upstream and downstream neighbors", () => {
    const trace = computeTracePath(workflow, "b");
    expect(trace.stepIds).toEqual(new Set(["a", "b", "c"]));
    // "d" is two hops downstream and "e" only shares an ancestor with "b" (via "a"), so neither
    // belongs in the local trace.
    expect(trace.stepIds.has("d")).toBe(false);
    expect(trace.stepIds.has("e")).toBe(false);
  });

  it("highlights only the anchor's outgoing edges", () => {
    const trace = computeTracePath(workflow, "b");
    expect(trace.edgeIds).toEqual(new Set(["b->c#1"]));
  });

  it("keeps the local neighborhood consistent from either end of the chain", () => {
    expect(computeTracePath(workflow, "a").stepIds).toEqual(new Set(["a", "b", "e"]));
    expect(computeTracePath(workflow, "a").edgeIds).toEqual(new Set(["a->b#0", "a->e#3"]));
    expect(computeTracePath(workflow, "d").stepIds).toEqual(new Set(["c", "d"]));
    expect(computeTracePath(workflow, "d").edgeIds).toEqual(new Set());
  });

  it("returns an empty trace for a step id that doesn't exist in the workflow", () => {
    const trace = computeTracePath(workflow, "not-a-real-step");
    expect(trace.stepIds.size).toBe(0);
    expect(trace.edgeIds.size).toBe(0);
  });

  it("terminates instead of looping forever when the graph has a cycle", () => {
    const cyclic = makeWorkflow(
      [makeStep("a"), makeStep("b"), makeStep("c")],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    );
    const start = Date.now();
    const trace = computeTracePath(cyclic, "a");
    expect(Date.now() - start).toBeLessThan(2000);
    expect(trace.stepIds).toEqual(new Set(["c", "a", "b"]));
    expect(trace.edgeIds).toEqual(new Set(["a->b#0"]));
  });
});
