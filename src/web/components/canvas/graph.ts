/**
 * Pure graph queries over a `Workflow`'s `connections`, used by keyboard navigation (contract
 * §11). Kept separate from `layout.ts` (which asks dagre to *position* the graph) because these
 * answer a different question: given the current step, where does "next"/"previous" go, and
 * what is a stable first/last step for Home/End. Never throws or hangs on a cycle.
 */
import type { Workflow } from "@schema/workflow";

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
