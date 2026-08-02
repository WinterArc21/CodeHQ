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
 * any step with zero outgoing connections; it naturally falls through to the outcome-column
 * placement below instead.
 *
 * ### The outcome column
 *
 * An outcome step whose *only* incoming connection comes from one already-positioned step (the
 * overwhelmingly common shape — a decision step failing straight to its own dedicated "400 Bad
 * Request" pill, never shared with anything else) is anchored level with that source: same y,
 * one dedicated column to the spine's right. This is what lets `edgeRouting.ts` draw a short
 * horizontal hop instead of a long detour — the geometry only reads as "a small step sideways"
 * because the node is actually positioned beside its source, not one dagre rank below it.
 *
 * When several such outcomes share one busy source (e.g. `validate-file` failing three different
 * ways), they cannot all occupy that same y in one column, so they stack downward from the
 * source's row in declaration order — vertically, never spilling into new side-by-side columns
 * the way the old per-rank branch-column logic did, which is what overflowed a 1440px canvas once
 * a single step had three failure branches.
 *
 * An outcome reached by *more than one* incoming connection (several distant branches converging
 * on one shared terminal, e.g. three decision steps that all fail through to the same "reject"
 * step several ranks apart) has no single source rank to sit beside, so it keeps the old
 * dagre-rank placement instead — which is exactly the shape `edgeRouting.ts`'s gutter-lane sidecar
 * routing was built for.
 */
import * as dagre from "@dagrejs/dagre";
import type { Workflow, WorkflowConnection } from "@schema/workflow";
import type { Depth } from "../../store/useCodeHQStore";
import { connectionStyle } from "../../design/semantics";
import { connectionLabelText, MIN_LABELED_RANK_GAP } from "./edgeLabel";
import { computeOutcomeStepIds, computeOutDegree, computeTopologicalOrder } from "./graph";
import {
  computeNodeHeight,
  computeOutcomeNodeWidth,
  effectiveDepthForStep,
  estimateLabelChipWidth,
  NODE_WIDTH,
  OUTCOME_NODE_HEIGHT,
} from "./nodeContent";

/** Vertical gap between ordinary ranks. Twenty-eight units leaves a visible band around the
 * connector and arrowhead, so adjacent cards read as individual steps rather than one dense
 * list, while remaining compact enough for the fitted 1440x900 canvas. Structural fan-out/in
 * still earns the larger minimum below. */
export const LAYOUT_RANK_SEP = 28;
/**
 * Minimum vertical gap around a structural fan-out or fan-in. React Flow puts a smooth-step
 * edge's horizontal run halfway through that gap; 44px leaves 22px on either side, enough for
 * the 10px rounded corner plus a straight, visible arrowhead approach. The ordinary 28px gap is
 * intentionally retained everywhere else so linear workflows stay compact.
 */
export const MIN_FAN_RANK_GAP = 44;
/** Horizontal gap between two nodes sharing a rank (e.g. two branch steps stacked in the same
 * side column) — generous enough that they read as clearly separate columns, not a graze. */
export const LAYOUT_NODE_SEP = 72;
export const LAYOUT_MARGIN_X = 40;
export const LAYOUT_MARGIN_Y = 28;
/** Horizontal distance from the spine's x to the first branch column (contract mandate: branch
 * steps depart visibly to the side, never crowd the spine itself). */
export const LAYOUT_BRANCH_OFFSET = NODE_WIDTH + LAYOUT_NODE_SEP;
/** Horizontal gap between the spine and the dedicated outcome column — a direct hop's own label
 * chip sits in this gap (`edgeRouting.ts`'s `buildDirectHopRoute`), so it has to be wider than
 * the generic `LAYOUT_NODE_SEP`. The Playwright canvas-grammar screenshots and overlap tests keep
 * that rendered clearance covered; longer labels widen the gap dynamically below. */
export const OUTCOME_COLUMN_GAP = 110;
/** Extra clear space around the widest outcome-edge label when it exceeds the default gap. */
const OUTCOME_LABEL_CLEARANCE = 32;
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

/**
 * Overrides the x of every step involved in genuine parallelism — a step with two or more *step*
 * successors reached by a primary (`success`/default) connection (outcomes don't count: an
 * outcome is a result, not concurrent work — same exclusion `computeSpine` already applies; a
 * `failure`/`conditional`/`async` branch doesn't count either: that is "what happens when this
 * doesn't go to plan", the existing side branch-column's job, not concurrency) is a fan-out
 * source. Its children spread into horizontal lanes centred under it (`LAYOUT_BRANCH_OFFSET`
 * apart, the same pitch the side-branch column already used, so a fan-out reads as "the same kind
 * of departure from the spine" rather than a new visual language) instead of the single-column
 * spine/branch-column placement the pass above already computed. A downstream step where two or
 * more of those lanes reconverge — a join — returns to the group's own centreline by averaging
 * its parents' lane x, which lands exactly back on the fork's own x for a symmetric fan-out (the
 * common case) and close to it for an asymmetric one.
 *
 * A pure single-chain workflow — every step has at most one *primary* non-outcome successor,
 * which both bundled example workflows and every existing spine-layout test fixture are — never
 * puts anything into `laneX` at all (the `siblings.length >= 2` branch below is the only way a
 * step enters the map, and that branch requires an actual fork), so every step's position is left
 * byte-identical to whatever the spine/branch-column pass already assigned it: this function can
 * only ever widen a genuinely parallel workflow, never change a linear one.
 *
 * Deterministic: walks a topological order (`graph.ts`'s `computeTopologicalOrder`, itself
 * tie-broken by original `steps[]` position) so a step's predecessors are always resolved before
 * the step itself, and a fork's own children are processed in `workflow.steps` declaration order.
 * Recurses "for free" for nested fan-out: a fork whose own x already came from an *outer* fork's
 * lane simply reads that already-overridden x as its own children's centreline
 * (`laneX.get(parentId) ?? positioned.get(parentId)?.x`), so a fork nested inside another fork's
 * lane needs no special-case code — it is exactly the same branch as a top-level fork, just
 * starting from a non-zero base x.
 */
function applyFanOutLanes(
  workflow: Workflow,
  connectedIds: ReadonlySet<string>,
  isOutcomeStep: (stepId: string) => boolean,
  positioned: Map<string, { x: number; y: number }>,
): void {
  const order = new Map(workflow.steps.map((step, index) => [step.id, index] as const));
  const primaryNonOutcomeSuccessors = (stepId: string): string[] => {
    const seen = new Set<string>();
    for (const connection of workflow.connections) {
      if (
        connection.from === stepId &&
        isPrimaryConnection(connection) &&
        connectedIds.has(connection.to) &&
        !isOutcomeStep(connection.to)
      ) {
        seen.add(connection.to);
      }
    }
    return Array.from(seen).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  };
  const primaryNonOutcomePredecessors = (stepId: string): string[] => {
    const seen = new Set<string>();
    for (const connection of workflow.connections) {
      if (
        connection.to === stepId &&
        isPrimaryConnection(connection) &&
        connectedIds.has(connection.from) &&
        !isOutcomeStep(connection.from)
      ) {
        seen.add(connection.from);
      }
    }
    return Array.from(seen).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  };

  const laneX = new Map<string, number>();
  const topoOrder = computeTopologicalOrder(workflow).filter((id) => connectedIds.has(id) && !isOutcomeStep(id));

  for (const id of topoOrder) {
    const preds = primaryNonOutcomePredecessors(id);
    if (preds.length === 1) {
      const parentId = preds[0]!;
      const siblings = primaryNonOutcomeSuccessors(parentId);
      if (siblings.length >= 2) {
        // `id` is one lane among its fork parent's children — offsets are symmetric around 0
        // (e.g. a 2-way fork is [-0.5, +0.5], a 3-way fork is [-1, 0, +1]) so the group's own
        // centroid always lands exactly on the parent's x, "centred beneath their common source".
        const index = siblings.indexOf(id);
        const offset = index - (siblings.length - 1) / 2;
        const parentX = laneX.get(parentId) ?? positioned.get(parentId)?.x;
        if (parentX !== undefined) {
          laneX.set(id, parentX + offset * LAYOUT_BRANCH_OFFSET);
        }
      } else if (laneX.has(parentId)) {
        // A single-successor continuation of an already-laned step: same lane, further down.
        laneX.set(id, laneX.get(parentId)!);
      }
    } else if (preds.length >= 2) {
      const touchedXs = preds
        .filter((predecessorId) => laneX.has(predecessorId))
        .map((predecessorId) => laneX.get(predecessorId)!);
      if (touchedXs.length > 0) {
        // A join: at least one incoming lane reconverges here. Average every predecessor's x
        // (falling back to its already-computed spine/branch-column x for any predecessor this
        // pass never touched) rather than tracking which fork "owns" this join explicitly — for
        // a fan-out's own children the average always resolves to the fork's own x; for a partial
        // rejoin (only some branches merge here) it still lands sensibly between them.
        const allXs = preds.map((predecessorId) => laneX.get(predecessorId) ?? positioned.get(predecessorId)?.x ?? 0);
        laneX.set(id, allXs.reduce((sum, x) => sum + x, 0) / allXs.length);
      }
    }
  }

  for (const [id, x] of laneX) {
    const point = positioned.get(id);
    if (point !== undefined) {
      positioned.set(id, { x, y: point.y });
    }
  }
}

interface RankBand {
  /** dagre's own centre-y for every node in this band (all equal in a simple TB layout, since
   * dagre positions an entire rank tier at once). */
  y: number;
  /** Tallest node height in this band — the same "a rank's height is its tallest member" fact
   * `edgeRouting.ts`'s `clearDepartureY` doc comment already relies on. */
  height: number;
  ids: string[];
}

/**
 * Widens only rank gaps that actually need it: a labelled primary connection needs room for its
 * chip, while a structural fan-out/fan-in needs room for the horizontal part and arrowhead of its
 * smooth-step path to remain visibly separate from both endpoint cards. Mutates the dagre graph's
 * own node `y` values in place (the same mutable label objects every later read of
 * `graph.node(id)` in `computeLayout` sees), so it must run right after `dagre.layout(graph)` and
 * before anything else reads node positions.
 *
 * Groups nodes into rank "bands" by their (rounded) dagre y — the same `Math.round(node.y)`
 * grouping key the branch-column placement below already uses for the same reason: dagre's rank
 * tiers, not floating-point noise. For each adjacent band pair crossed by a labelled or fan
 * connection, computes the deficit from that connection's required gap, then shifts every band
 * at or after the widened gap down by that deficit — cascading, so consecutive crowded gaps each
 * get exactly the room they individually need rather than one gap "borrowing" another's space.
 */
function expandCrowdedRankGaps(
  workflow: Workflow,
  graph: dagre.graphlib.Graph,
  connectedIds: ReadonlySet<string>,
  sizeById: ReadonlyMap<string, { width: number; height: number }>,
  isOutcomeStep: (stepId: string) => boolean,
): void {
  const bandIndexById = new Map<string, number>();
  const bandByKey = new Map<number, RankBand>();
  const bands: RankBand[] = [];
  for (const id of connectedIds) {
    const node = graph.node(id);
    const height = sizeById.get(id)?.height ?? 0;
    const key = Math.round(node.y);
    let band = bandByKey.get(key);
    if (band === undefined) {
      band = { y: node.y, height, ids: [] };
      bandByKey.set(key, band);
      bands.push(band);
    } else {
      band.height = Math.max(band.height, height);
    }
    band.ids.push(id);
  }
  bands.sort((a, b) => a.y - b.y);
  bands.forEach((band, index) => band.ids.forEach((id) => bandIndexById.set(id, index)));

  // Count distinct primary work-step neighbours, matching `applyFanOutLanes`'s definition of
  // genuine parallelism. Duplicate declarations must not manufacture a fork or join, and terminal
  // outcomes remain results rather than parallel work.
  const primarySuccessors = new Map<string, Set<string>>();
  const primaryPredecessors = new Map<string, Set<string>>();
  for (const connection of workflow.connections) {
    if (
      !isPrimaryConnection(connection) ||
      connection.from === connection.to ||
      !connectedIds.has(connection.from) ||
      !connectedIds.has(connection.to)
    ) {
      continue;
    }
    if (!isOutcomeStep(connection.to)) {
      const successors = primarySuccessors.get(connection.from) ?? new Set<string>();
      successors.add(connection.to);
      primarySuccessors.set(connection.from, successors);

      const predecessors = primaryPredecessors.get(connection.to) ?? new Set<string>();
      predecessors.add(connection.from);
      primaryPredecessors.set(connection.to, predecessors);
    }
  }

  const deficitAfterBand = new Array<number>(bands.length).fill(0);
  for (const connection of workflow.connections) {
    if (!isPrimaryConnection(connection)) {
      continue;
    }
    if (!connectedIds.has(connection.from) || !connectedIds.has(connection.to)) {
      continue;
    }
    const sourceBand = bandIndexById.get(connection.from);
    const targetBand = bandIndexById.get(connection.to);
    if (sourceBand === undefined || targetBand === undefined || targetBand !== sourceBand + 1) {
      continue;
    }
    const source = bands[sourceBand]!;
    const target = bands[targetBand]!;
    const actualGap = target.y - target.height / 2 - (source.y + source.height / 2);
    const isLabeled = connectionLabelText(connection) !== undefined;
    const isFanConnection =
      (primarySuccessors.get(connection.from)?.size ?? 0) >= 2 ||
      (primaryPredecessors.get(connection.to)?.size ?? 0) >= 2;
    if (!isLabeled && !isFanConnection) {
      continue;
    }
    const requiredGap = Math.max(isLabeled ? MIN_LABELED_RANK_GAP : 0, isFanConnection ? MIN_FAN_RANK_GAP : 0);
    const deficit = Math.max(0, requiredGap - actualGap);
    deficitAfterBand[sourceBand] = Math.max(deficitAfterBand[sourceBand]!, deficit);
  }

  let cumulativeShift = 0;
  for (const band of bands) {
    if (cumulativeShift > 0) {
      for (const id of band.ids) {
        graph.node(id).y += cumulativeShift;
      }
    }
    const bandIndex = bandIndexById.get(band.ids[0]!)!;
    cumulativeShift += deficitAfterBand[bandIndex]!;
  }
}

export function computeLayout(workflow: Workflow, opts: ComputeLayoutOptions): LayoutResult {
  const outDegree = computeOutDegree(workflow);
  const { connectedIds, isolatedIds } = partitionSteps(workflow);
  const outcomeStepIds = computeOutcomeStepIds(workflow);
  const isOutcomeStep = (stepId: string): boolean => outcomeStepIds.has(stepId);

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
    expandCrowdedRankGaps(workflow, graph, connectedIds, sizeById, isOutcomeStep);

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

    // Off-spine steps that are genuine work (still have outgoing connections — a step reached
    // only by a branch but not itself terminal) land in the same rank-column-stacking scheme as
    // before. In practice neither example workflow has one of these (every off-spine step in
    // both is a terminal outcome), but the shape is real and worth keeping: land in the same
    // dagre rank, stack into successive columns instead of overlapping. Walked in
    // `workflow.steps` order (not `connectedIds`' insertion order, which follows connection
    // declaration order and would put branch columns in an arbitrary sequence) so the column a
    // branch step lands in is a stable function of its own position in the workflow, and keyed by
    // the rounded centerline so dagre's float arithmetic can't split one rank into two groups.
    const branchColumnCountByRank = new Map<number, number>();
    for (const step of workflow.steps) {
      if (!connectedIds.has(step.id) || spine.has(step.id) || isOutcomeStep(step.id)) {
        continue;
      }
      const node = graph.node(step.id);
      const height = sizeById.get(step.id)?.height ?? 0;
      const rankKey = Math.round(node.y);
      const column = branchColumnCountByRank.get(rankKey) ?? 0;
      branchColumnCountByRank.set(rankKey, column + 1);
      positioned.set(step.id, { x: branchColumnX + column * LAYOUT_BRANCH_OFFSET, y: node.y - height / 2 });
    }

    // Fan-out can move work lanes farther right than the ordinary branch columns. Resolve those
    // lanes before deriving the outcome column so no parallel work card can wind up underneath
    // an outcome pill.
    applyFanOutLanes(workflow, connectedIds, isOutcomeStep, positioned);
    const nonOutcomeRight = Math.max(
      LAYOUT_MARGIN_X + NODE_WIDTH,
      ...Array.from(positioned.entries())
        .filter(([id]) => !isOutcomeStep(id))
        .map(([id, point]) => point.x + (sizeById.get(id)?.width ?? NODE_WIDTH)),
    );
    const widestOutcomeLabel = Math.max(
      0,
      ...workflow.connections
        .filter((connection) => isOutcomeStep(connection.to))
        .map((connection) => connectionLabelText(connection))
        .filter((label): label is string => label !== undefined)
        .map(estimateLabelChipWidth),
    );
    const outcomeGap = Math.max(OUTCOME_COLUMN_GAP, widestOutcomeLabel + OUTCOME_LABEL_CLEARANCE);
    const outcomeColumnX = nonOutcomeRight + outcomeGap;

    // Outcome steps (see "the outcome column" above): a sole-feed outcome anchors level with its
    // one source; several sole-feed outcomes sharing a source stack downward from that row in
    // declaration order; a shared outcome (more than one incoming connection) falls back to its
    // own dagre rank, unchanged from the original behaviour.
    const incomingByOutcome = new Map<string, WorkflowConnection[]>();
    for (const connection of workflow.connections) {
      if (!isValidConnection(connectedIds, connection) || connection.from === connection.to || !isOutcomeStep(connection.to)) {
        continue;
      }
      const list = incomingByOutcome.get(connection.to) ?? [];
      list.push(connection);
      incomingByOutcome.set(connection.to, list);
    }

    interface OutcomeAnchor {
      id: string;
      anchorY: number;
      height: number;
    }
    const outcomeAnchors: OutcomeAnchor[] = [];
    for (const step of workflow.steps) {
      if (!connectedIds.has(step.id) || !isOutcomeStep(step.id)) {
        continue;
      }
      const height = sizeById.get(step.id)?.height ?? 0;
      const incoming = incomingByOutcome.get(step.id) ?? [];
      const soleSourceId = incoming.length === 1 ? incoming[0]!.from : undefined;
      const soleSource = soleSourceId !== undefined ? positioned.get(soleSourceId) : undefined;
      const soleSourceHeight = soleSourceId !== undefined ? sizeById.get(soleSourceId)?.height : undefined;
      const node = graph.node(step.id);
      // Anchored on the *vertical centre* of its sole source, not its top edge: a taller source
      // (e.g. one with an extra facts row) would otherwise leave the hop into a fixed-height
      // outcome pill visibly bent, since the pill's own centre would land above the source's.
      // Centring both keeps `edgeRouting.ts`'s direct hop a genuinely straight horizontal line in
      // the common single-outcome case.
      const anchorY =
        soleSource !== undefined && soleSourceHeight !== undefined
          ? soleSource.y + soleSourceHeight / 2 - height / 2
          : node.y - height / 2;
      outcomeAnchors.push({ id: step.id, anchorY, height });
    }
    // `Array#sort` is stable, so outcomes anchored to the same y (the same shared source) keep
    // `workflow.steps` declaration order when they stack — top-to-bottom reading order, matching
    // every other tie-break in this file.
    outcomeAnchors.sort((a, b) => a.anchorY - b.anchorY);
    let outcomeCursorY = -Infinity;
    for (const anchor of outcomeAnchors) {
      const y = Math.max(anchor.anchorY, outcomeCursorY);
      positioned.set(anchor.id, { x: outcomeColumnX, y });
      outcomeCursorY = y + anchor.height + LAYOUT_RANK_SEP;
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
