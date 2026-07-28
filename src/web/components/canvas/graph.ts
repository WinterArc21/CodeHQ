/**
 * Pure graph queries over a `Workflow`'s `connections`, used by keyboard navigation (contract
 * §11), the edge-grammar retry/outcome derivation, and path tracing. Kept separate from
 * `layout.ts` (which asks dagre to *position* the graph) because these answer a different
 * question: given the current step, where does "next"/"previous" go, what is a stable first/last
 * step for Home/End, which connections loop back on the graph, and what does a step's full
 * upstream/downstream trace look like. Never throws or hangs on a cycle.
 */
import type { Workflow, WorkflowConnection } from "@schema/workflow";

/** Mirrors the edge-id derivation `layout.ts`'s `LayoutEdge` uses (`connection.id`, falling back
 * to `${from}->${to}#${index}` keyed by the connection's position in `workflow.connections`) so
 * every function here produces ids that line up with the ones `WorkflowEdge` actually renders. */
function connectionEdgeId(connection: WorkflowConnection, index: number): string {
  return connection.id ?? `${connection.from}->${connection.to}#${index}`;
}

function validStepIds(workflow: Workflow): Set<string> {
  return new Set(workflow.steps.map((step) => step.id));
}

function stepOrderIndex(workflow: Workflow): Map<string, number> {
  const order = new Map<string, number>();
  workflow.steps.forEach((step, index) => order.set(step.id, index));
  return order;
}

/**
 * Successor step ids reachable by one outgoing connection from `stepId`, deduplicated and
 * ordered by the target's original position in `workflow.steps` — a deterministic tie-break
 * when a step branches to several others.
 */
export function successorIds(workflow: Workflow, stepId: string): string[] {
  const order = stepOrderIndex(workflow);
  const seen = new Set<string>();
  for (const connection of workflow.connections) {
    if (connection.from === stepId && order.has(connection.to)) {
      seen.add(connection.to);
    }
  }
  return Array.from(seen).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/** Predecessor step ids with one outgoing connection into `stepId`, same deterministic order. */
export function predecessorIds(workflow: Workflow, stepId: string): string[] {
  const order = stepOrderIndex(workflow);
  const seen = new Set<string>();
  for (const connection of workflow.connections) {
    if (connection.to === stepId && order.has(connection.from)) {
      seen.add(connection.from);
    }
  }
  return Array.from(seen).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/**
 * A topological ordering of step ids (Kahn's algorithm), tie-broken by original `steps[]` order
 * so it is deterministic across calls. A cycle leaves some steps with a permanently positive
 * in-degree; rather than hang, each remaining pass picks the lowest-original-index step among
 * whatever is left, breaking the cycle deterministically instead of stalling.
 */
export function computeTopologicalOrder(workflow: Workflow): string[] {
  const order = stepOrderIndex(workflow);
  const inDegree = new Map<string, number>();
  workflow.steps.forEach((step) => inDegree.set(step.id, 0));
  for (const connection of workflow.connections) {
    if (inDegree.has(connection.from) && inDegree.has(connection.to)) {
      inDegree.set(connection.to, (inDegree.get(connection.to) ?? 0) + 1);
    }
  }

  const remaining = new Set(workflow.steps.map((step) => step.id));
  const result: string[] = [];

  while (remaining.size > 0) {
    const ready = Array.from(remaining)
      .filter((id) => (inDegree.get(id) ?? 0) <= 0)
      .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

    // No zero-in-degree node left: a cycle accounts for everything remaining. Break it
    // deterministically by taking the lowest-original-index step instead of looping forever.
    const next = ready[0] ?? Array.from(remaining).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))[0];
    if (next === undefined) {
      break;
    }

    result.push(next);
    remaining.delete(next);
    for (const connection of workflow.connections) {
      if (connection.from === next && inDegree.has(connection.to)) {
        inDegree.set(connection.to, (inDegree.get(connection.to) ?? 0) - 1);
      }
    }
  }

  return result;
}

/** Number of valid outgoing connections per step id — the graph-shape signal an "outcome" node
 * (contract mandate: "terminal steps... render as visually distinct outcome nodes") derives from.
 * No schema change: a step is terminal purely because nothing in `connections` ever names it as
 * a `from`. */
export function computeOutDegree(workflow: Workflow): Map<string, number> {
  const stepIds = validStepIds(workflow);
  const outDegree = new Map<string, number>(workflow.steps.map((step) => [step.id, 0] as const));
  for (const connection of workflow.connections) {
    if (stepIds.has(connection.from) && stepIds.has(connection.to)) {
      outDegree.set(connection.from, (outDegree.get(connection.from) ?? 0) + 1);
    }
  }
  return outDegree;
}

/** The connection `type`s of every valid connection arriving at each step id — what
 * `design/semantics.ts`'s `outcomeTone` uses to decide whether a terminal step reads as a
 * success or a failure outcome. */
export function computeIncomingTypes(workflow: Workflow): Map<string, Array<WorkflowConnection["type"]>> {
  const stepIds = validStepIds(workflow);
  const incoming = new Map<string, Array<WorkflowConnection["type"]>>();
  for (const connection of workflow.connections) {
    if (!stepIds.has(connection.from) || !stepIds.has(connection.to)) {
      continue;
    }
    const list = incoming.get(connection.to) ?? [];
    list.push(connection.type);
    incoming.set(connection.to, list);
  }
  return incoming;
}

/**
 * Ids (in `layout.ts`/`WorkflowEdge`'s `${from}->${to}#${index}` scheme) of every connection that
 * is a "back edge": a self-loop, or a connection whose target is already an ancestor of its
 * source in the graph (contract: "Detect back edges... no schema change needed"). Standard DFS
 * back-edge detection — a connection closes a back edge exactly when its target is still on the
 * current recursion stack when the source is visited. Deterministic: steps and their outgoing
 * connections are always walked in `workflow.steps`/`workflow.connections` order.
 */
export function computeBackEdgeIds(workflow: Workflow): Set<string> {
  const stepIds = validStepIds(workflow);
  const backEdgeIds = new Set<string>();
  const adjacency = new Map<string, Array<{ to: string; edgeId: string }>>();

  workflow.connections.forEach((connection, index) => {
    if (!stepIds.has(connection.from) || !stepIds.has(connection.to)) {
      return;
    }
    const edgeId = connectionEdgeId(connection, index);
    if (connection.from === connection.to) {
      backEdgeIds.add(edgeId);
      return;
    }
    const list = adjacency.get(connection.from) ?? [];
    list.push({ to: connection.to, edgeId });
    adjacency.set(connection.from, list);
  });

  const state = new Map<string, "visiting" | "done">();
  function visit(stepId: string): void {
    state.set(stepId, "visiting");
    for (const { to, edgeId } of adjacency.get(stepId) ?? []) {
      const toState = state.get(to);
      if (toState === "visiting") {
        backEdgeIds.add(edgeId);
      } else if (toState === undefined) {
        visit(to);
      }
    }
    state.set(stepId, "done");
  }
  for (const step of workflow.steps) {
    if (!state.has(step.id)) {
      visit(step.id);
    }
  }

  return backEdgeIds;
}

export interface TracePath {
  /** Every step id on the anchor's complete upstream-or-downstream path, including the anchor
   * itself. */
  stepIds: Set<string>;
  /** Every connection id (same id scheme as above) linking two steps in `stepIds` along that
   * path. */
  edgeIds: Set<string>;
}

/**
 * A step's complete upstream (every ancestor, transitively) and downstream (every descendant,
 * transitively) trace — "what feeds this, what depends on this" (contract §11's path-tracing
 * mandate), computed as two independent breadth-first walks so a cycle anywhere in the graph
 * still terminates instead of looping forever. Pure: same `Workflow` and `stepId` always produce
 * the same result, no DOM, no randomness — kept that way so it stays unit-testable on its own.
 */
export function computeTracePath(workflow: Workflow, stepId: string): TracePath {
  const stepIds = validStepIds(workflow);
  if (!stepIds.has(stepId)) {
    return { stepIds: new Set(), edgeIds: new Set() };
  }

  const forward = new Map<string, Array<{ to: string; edgeId: string }>>();
  const backward = new Map<string, Array<{ from: string; edgeId: string }>>();
  workflow.connections.forEach((connection, index) => {
    if (!stepIds.has(connection.from) || !stepIds.has(connection.to)) {
      return;
    }
    const edgeId = connectionEdgeId(connection, index);
    const forwardList = forward.get(connection.from) ?? [];
    forwardList.push({ to: connection.to, edgeId });
    forward.set(connection.from, forwardList);
    const backwardList = backward.get(connection.to) ?? [];
    backwardList.push({ from: connection.from, edgeId });
    backward.set(connection.to, backwardList);
  });

  const resultSteps = new Set<string>([stepId]);
  const resultEdges = new Set<string>();

  const downstreamQueue = [stepId];
  const downstreamSeen = new Set([stepId]);
  while (downstreamQueue.length > 0) {
    const current = downstreamQueue.shift()!;
    for (const { to, edgeId } of forward.get(current) ?? []) {
      resultEdges.add(edgeId);
      resultSteps.add(to);
      if (!downstreamSeen.has(to)) {
        downstreamSeen.add(to);
        downstreamQueue.push(to);
      }
    }
  }

  const upstreamQueue = [stepId];
  const upstreamSeen = new Set([stepId]);
  while (upstreamQueue.length > 0) {
    const current = upstreamQueue.shift()!;
    for (const { from, edgeId } of backward.get(current) ?? []) {
      resultEdges.add(edgeId);
      resultSteps.add(from);
      if (!upstreamSeen.has(from)) {
        upstreamSeen.add(from);
        upstreamQueue.push(from);
      }
    }
  }

  return { stepIds: resultSteps, edgeIds: resultEdges };
}
