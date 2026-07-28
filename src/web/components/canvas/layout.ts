/**
 * Deterministic, framework-free layout (contract §11 canvas/layout.ts). Pure function of a
 * `Workflow` plus the current depth/expansion UI state: same input always produces an
 * identical `LayoutResult` — no `Date`, no randomness, no dependence on object iteration order
 * (every loop below walks `workflow.steps`/`workflow.connections`, both real arrays with a
 * fixed order). Node *heights* come from `nodeContent.ts`, so a node that grows at a deeper
 * depth or when expanded pushes its neighbours instead of overlapping them. Node *vertical*
 * position (rank) comes from dagre; node *horizontal* position is decided by this file, not
 * dagre — see "the spine" below.
 *
 * Direction is top-to-bottom (contract §11's original left-to-right default did not survive
 * measurement: a 300px-wide, 120px-ranksep chain of 7 steps renders ~3100px wide, which cannot
 * fit a ~1100px canvas viewport at a legible zoom). Reading a code path top-down is also the
 * natural direction for "what happens next", and it lets the fixed-width node grow wide
 * instead of thin, which serves the information-density goal directly.
 *
 * ### The spine
 *
 * Letting dagre choose x for every node produced a "staircase": a `failure`/`conditional`
 * connection that skips several ranks (e.g. an early decision step failing straight to the
 * terminal step) makes dagre insert invisible routing (dummy) nodes through every rank in
 * between, and dagre's crossing-minimization then nudges each real node in those ranks sideways
 * to make room — so the primary chain drifted a little further right on every rank, reading as a
 * layout artifact instead of a deliberate line. Since `WorkflowEdge` computes its own path from
 * each node's own rendered position (`getSmoothStepPath`) rather than from dagre's routing
 * points, dagre's x is never actually load-bearing for edge rendering — only for avoiding node
 * overlap — which means it is safe to override.
 *
 * So x is decided in two passes: dagre still assigns y/rank (it is good at ordering by
 * dependency depth and sizing ranks for variable node heights). Then `computeSpine` walks the
 * *primary*-weight connections only (`type` `undefined`/`"success"` — the same classification
 * `design/semantics.ts` already uses to render the primary path bolder than a branch) from the
 * entry step, following the longest remaining primary chain at each fork, and every step on that
 * walk is pinned to one constant x: a true vertical spine. Any step the spine walk never reaches
 * (a step only reachable via a `failure`/`conditional`/`async` connection) is a genuine branch:
 * it renders in a fixed column to the spine's right, stacked further right only if another branch
 * step already claims that column at the same rank.
 *
 * One more exclusion: a terminal ("outcome") step is never added to the spine even when its only
 * incoming connection is primary-weight — e.g. `Save Result --success--> 201 Created`. An outcome
 * is a *result*, not the next unit of work, so it belongs in the outcome column beside the other
 * results (contract's own worked example puts a plain 200/201 success pill in the same right-hand
 * column as the failure pills, not back on the spine). `computeSpine` simply refuses to walk onto
 * any step with zero outgoing connections; it naturally falls through to the existing branch-
 * column placement below instead.
 */
import * as dagre from "dagre";
import type { Workflow, WorkflowConnection } from "@schema/workflow";
import type { Depth } from "../../store/useObservatoryStore";
import { connectionStyle } from "../../design/semantics";
import { computeOutDegree } from "./graph";
import { computeNodeHeight, computeOutcomeNodeWidth, effectiveDepthForStep, NODE_WIDTH, OUTCOME_NODE_HEIGHT } from "./nodeContent";

/** Vertical gap between ranks — small relative to `LAYOUT_NODE_SEP` because the node itself is
 * now wide and short: most of the workflow's readable footprint should come from row height, not
 * air between rows, or a 6-9 step workflow cannot fit a 900px-tall viewport without panning. */
export const LAYOUT_RANK_SEP = 18;
/** Horizontal gap between two nodes sharing a rank (e.g. two branch steps stacked in the same
 * side column) — generous enough that they read as clearly separate columns, not a graze. */
export const LAYOUT_NODE_SEP = 72;
export const LAYOUT_MARGIN_X = 40;
export const LAYOUT_MARGIN_Y = 28;
/** Horizontal distance from the spine's x to the first branch column (contract mandate: branch
 * steps depart visibly to the side, never crowd the spine itself). */
export const LAYOUT_BRANCH_OFFSET = NODE_WIDTH + LAYOUT_NODE_SEP;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The step's position in `workflow.steps`, for stable rendering (e.g. the index badge). */
  index: number;
  /** Out-degree 0 in `workflow.connections` (contract: terminal steps render as outcome pills,
   * not work-step cards). Carried on the layout node itself so `buildFlowElements.ts` has a
   * single source of truth for "which node type" instead of re-deriving it. */
  isOutcome: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  connection: WorkflowConnection;
}

export interface LayoutBounds {
  width: number;
  height: number;
}

export interface ComputeLayoutOptions {
  depth: Depth;
  expandedStepIds: ReadonlySet<string> | Record<string, true>;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  bounds: LayoutBounds;
}

/** A connection is only meaningful to the layout graph when both endpoints are real steps. */
function isValidConnection(stepIds: ReadonlySet<string>, connection: WorkflowConnection): boolean {
  return stepIds.has(connection.from) && stepIds.has(connection.to);
}

/**
 * Steps touched by at least one valid connection (either end) get positioned by dagre.
 * Fully isolated steps — including every step when a workflow has zero connections at all —
 * dagre would otherwise stack in a single column (its rank-0 default for edge-less nodes), so
 * they are laid out separately, left to right, in their own row instead.
 */
function partitionSteps(workflow: Workflow): { connectedIds: Set<string>; isolatedIds: string[] } {
  const stepIds = new Set(workflow.steps.map((step) => step.id));
  const connectedIds = new Set<string>();
  for (const connection of workflow.connections) {
    if (isValidConnection(stepIds, connection)) {
      connectedIds.add(connection.from);
      connectedIds.add(connection.to);
    }
  }
  const isolatedIds = workflow.steps.map((step) => step.id).filter((id) => !connectedIds.has(id));
  return { connectedIds, isolatedIds };
}

/** Whether a connection renders as the visually dominant "primary" path — delegated to
 * `design/semantics.ts` so the spine can never disagree with what the edge itself renders as. */
function isPrimaryConnection(connection: WorkflowConnection): boolean {
  return connectionStyle(connection.type).weight === "primary";
}

/**
 * The set of step ids forming the spine: the single dominant chain of primary (`success`/default)
 * connections from the entry step onward. Walks greedily; at a fork it prefers the successor with
 * the longest remaining primary chain ahead of it, tie-broken by the successor's original
 * position in `workflow.steps` for determinism. In the common case — one primary connection in,
 * one out, per step — this puts every connected step on the spine; a step is only left off it
 * when its *only* inbound connection is a `failure`/`conditional`/`async` branch.
 */
function computeSpine(workflow: Workflow, connectedIds: ReadonlySet<string>, outDegree: ReadonlyMap<string, number>): Set<string> {
  const order = new Map(workflow.steps.map((step, index) => [step.id, index] as const));
  const primarySuccessors = new Map<string, string[]>();
  const primaryInDegree = new Map<string, number>();
  for (const id of connectedIds) {
    primarySuccessors.set(id, []);
    primaryInDegree.set(id, 0);
  }
  for (const connection of workflow.connections) {
    if (!isValidConnection(connectedIds, connection) || connection.from === connection.to) {
      continue;
    }
    if (!isPrimaryConnection(connection)) {
      continue;
    }
    primarySuccessors.get(connection.from)?.push(connection.to);
    primaryInDegree.set(connection.to, (primaryInDegree.get(connection.to) ?? 0) + 1);
  }

  // Longest remaining primary chain starting at each step, memoized. `visiting` breaks a cycle
  // deterministically (the back-edge contributes zero further length) instead of recursing
  // forever — mirrors the cycle guard in `graph.ts`'s topological order.
  const longestFrom = new Map<string, number>();
  const visiting = new Set<string>();
  function longestChain(id: string): number {
    const memoized = longestFrom.get(id);
    if (memoized !== undefined) {
      return memoized;
    }
    if (visiting.has(id)) {
      return 0;
    }
    visiting.add(id);
    let best = 0;
    for (const next of primarySuccessors.get(id) ?? []) {
      best = Math.max(best, 1 + longestChain(next));
    }
    visiting.delete(id);
    longestFrom.set(id, best);
    return best;
  }
  for (const id of connectedIds) {
    longestChain(id);
  }

  const connectedSteps = workflow.steps.filter((step) => connectedIds.has(step.id));
  const uniqueEntryStep = connectedSteps.filter((step) => step.category === "entry");
  const entryRoot = uniqueEntryStep.length === 1 ? uniqueEntryStep[0] : undefined;
  const zeroInDegreeRoot = connectedSteps.find((step) => (primaryInDegree.get(step.id) ?? 0) === 0);
  const root = (entryRoot ?? zeroInDegreeRoot ?? connectedSteps[0])?.id;

  const spine = new Set<string>();
  let current = root;
  while (current !== undefined && !spine.has(current)) {
    spine.add(current);
    const candidates = (primarySuccessors.get(current) ?? []).filter(
      (id) => !spine.has(id) && (outDegree.get(id) ?? 0) > 0,
    );
    candidates.sort((a, b) => {
      const byChainLength = longestChain(b) - longestChain(a);
      return byChainLength !== 0 ? byChainLength : (order.get(a) ?? 0) - (order.get(b) ?? 0);
    });
    current = candidates[0];
  }
  return spine;
}

export function computeLayout(workflow: Workflow, opts: ComputeLayoutOptions): LayoutResult {
  const outDegree = computeOutDegree(workflow);
  const { connectedIds, isolatedIds } = partitionSteps(workflow);
  // A step only reads as a terminal "outcome" when something actually connects into it —
  // otherwise "isolatedIds" (a step with *no* connections at all, e.g. a lone step in a
  // single-step workflow, or one an agent hasn't wired up yet) would count as terminal too and
  // lose its normal work-step sizing/depth growth for no real reason: an outcome is specifically
  // "where a path lands", which requires there to be a path.
  const isOutcomeStep = (stepId: string): boolean => connectedIds.has(stepId) && (outDegree.get(stepId) ?? 0) === 0;

  const sizeById = new Map<string, { width: number; height: number }>(
    workflow.steps.map((step) => {
      if (isOutcomeStep(step.id)) {
        return [step.id, { width: computeOutcomeNodeWidth(step), height: OUTCOME_NODE_HEIGHT }];
      }
      const effectiveDepth = effectiveDepthForStep(step, opts.depth, opts.expandedStepIds);
      return [step.id, { width: NODE_WIDTH, height: computeNodeHeight(step, effectiveDepth) }];
    }),
  );

  const positioned = new Map<string, { x: number; y: number }>();

  if (connectedIds.size > 0) {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: "TB",
      nodesep: LAYOUT_NODE_SEP,
      ranksep: LAYOUT_RANK_SEP,
      marginx: LAYOUT_MARGIN_X,
      marginy: LAYOUT_MARGIN_Y,
    });
    graph.setDefaultEdgeLabel(() => ({}));

    for (const id of connectedIds) {
      const size = sizeById.get(id);
      graph.setNode(id, { width: size?.width ?? NODE_WIDTH, height: size?.height ?? 0 });
    }
    for (const connection of workflow.connections) {
      if (isValidConnection(connectedIds, connection) && connection.from !== connection.to) {
        graph.setEdge(connection.from, connection.to);
      }
    }

    dagre.layout(graph);

    const spine = computeSpine(workflow, connectedIds, outDegree);
    const spineX = LAYOUT_MARGIN_X;
    const branchColumnX = LAYOUT_MARGIN_X + LAYOUT_BRANCH_OFFSET;

    for (const id of connectedIds) {
      if (!spine.has(id)) {
        continue;
      }
      const node = graph.node(id);
      const height = sizeById.get(id)?.height ?? 0;
      positioned.set(id, { x: spineX, y: node.y - height / 2 });
    }

    // Branch steps that land in the same dagre rank (identical centerline y) stack into
    // successive columns instead of overlapping each other, closest column first. Walked in
    // `workflow.steps` order (not `connectedIds`' insertion order, which follows connection
    // declaration order and would put branch columns in an arbitrary sequence) so the column a
    // branch step lands in is a stable function of its own position in the workflow, and keyed by
    // the rounded centerline so dagre's float arithmetic can't split one rank into two groups.
    const branchColumnCountByRank = new Map<number, number>();
    for (const step of workflow.steps) {
      if (!connectedIds.has(step.id) || spine.has(step.id)) {
        continue;
      }
      const node = graph.node(step.id);
      const height = sizeById.get(step.id)?.height ?? 0;
      const rankKey = Math.round(node.y);
      const column = branchColumnCountByRank.get(rankKey) ?? 0;
      branchColumnCountByRank.set(rankKey, column + 1);
      positioned.set(step.id, { x: branchColumnX + column * LAYOUT_BRANCH_OFFSET, y: node.y - height / 2 });
    }
  }

  const connectedMaxY = Math.max(
    LAYOUT_MARGIN_Y,
    ...Array.from(positioned.entries()).map(([id, point]) => point.y + (sizeById.get(id)?.height ?? 0)),
  );
  const isolatedRowY = connectedIds.size > 0 ? connectedMaxY + LAYOUT_RANK_SEP : LAYOUT_MARGIN_Y;

  let cursorX = LAYOUT_MARGIN_X;
  for (const id of isolatedIds) {
    positioned.set(id, { x: cursorX, y: isolatedRowY });
    cursorX += NODE_WIDTH + LAYOUT_NODE_SEP;
  }

  const nodes: LayoutNode[] = workflow.steps.map((step, index) => {
    const point = positioned.get(step.id) ?? { x: LAYOUT_MARGIN_X, y: LAYOUT_MARGIN_Y };
    const size = sizeById.get(step.id);
    return {
      id: step.id,
      x: point.x,
      y: point.y,
      width: size?.width ?? NODE_WIDTH,
      height: size?.height ?? 0,
      index,
      isOutcome: isOutcomeStep(step.id),
    };
  });

  const edges: LayoutEdge[] = workflow.connections.map((connection, index) => ({
    id: connection.id ?? `${connection.from}->${connection.to}#${index}`,
    source: connection.from,
    target: connection.to,
    connection,
  }));

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    nodes,
    edges,
    bounds: { width: maxX - minX, height: maxY - minY },
  };
}
