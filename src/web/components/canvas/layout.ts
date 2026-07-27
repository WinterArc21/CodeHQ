/**
 * Deterministic, framework-free layout (contract §11 canvas/layout.ts). Pure function of a
 * `Workflow` plus the current depth/expansion UI state: same input always produces an
 * identical `LayoutResult` — no `Date`, no randomness, no dependence on object iteration order
 * (every loop below walks `workflow.steps`/`workflow.connections`, both real arrays with a
 * fixed order). Node *positions* come from dagre; node *sizes* come from `nodeContent.ts`, so a
 * node that grows at a deeper depth or when expanded pushes its neighbours instead of
 * overlapping them.
 *
 * Direction is top-to-bottom (contract §11's original left-to-right default did not survive
 * measurement: a 300px-wide, 120px-ranksep chain of 7 steps renders ~3100px wide, which cannot
 * fit a ~1100px canvas viewport at a legible zoom). Reading a code path top-down is also the
 * natural direction for "what happens next", and it lets the fixed-width node grow wide
 * instead of thin, which serves the
 * information-density goal directly. Primary (`success`/default) connections therefore run
 * downward; `failure`/`conditional` branches that target a later, already-downstream step (most
 * commonly a shared error-handling step) route as smoothstep diagonals rather than new columns,
 * so the graph stays essentially single-file for a linear workflow and only gains a second
 * column when a step's *only* onward path is a branch.
 */
import * as dagre from "dagre";
import type { Workflow, WorkflowConnection } from "@schema/workflow";
import type { Depth } from "../../store/useObservatoryStore";
import { computeNodeHeight, effectiveDepthForStep, NODE_WIDTH } from "./nodeContent";

/** Vertical gap between ranks — small relative to `LAYOUT_NODE_SEP` because the node itself is
 * now wide and short: most of the workflow's readable footprint should come from row height, not
 * air between rows, or a 6-9 step workflow cannot fit a 900px-tall viewport without panning. */
export const LAYOUT_RANK_SEP = 28;
/** Horizontal gap between two nodes sharing a rank (e.g. a failure branch sitting beside the
 * step that continues past it) — generous enough that a branch reads as a clearly separate
 * column, not a graze against the main line. */
export const LAYOUT_NODE_SEP = 72;
export const LAYOUT_MARGIN_X = 40;
export const LAYOUT_MARGIN_Y = 28;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The step's position in `workflow.steps`, for stable rendering (e.g. the index badge). */
  index: number;
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

export function computeLayout(workflow: Workflow, opts: ComputeLayoutOptions): LayoutResult {
  const sizeById = new Map(
    workflow.steps.map((step) => {
      const effectiveDepth = effectiveDepthForStep(step, opts.depth, opts.expandedStepIds);
      return [step.id, { width: NODE_WIDTH, height: computeNodeHeight(step, effectiveDepth) }] as const;
    }),
  );

  const { connectedIds, isolatedIds } = partitionSteps(workflow);
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

    for (const id of connectedIds) {
      const node = graph.node(id);
      const size = sizeById.get(id);
      const width = size?.width ?? NODE_WIDTH;
      const height = size?.height ?? 0;
      positioned.set(id, { x: node.x - width / 2, y: node.y - height / 2 });
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
