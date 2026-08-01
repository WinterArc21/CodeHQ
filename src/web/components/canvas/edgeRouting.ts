/**
 * Deterministic "sidecar" routing for branch connections (contract mandate: "no branch edge may
 * pass under or through a node box"). Pure geometry over an already-computed `LayoutResult` — no
 * DOM, no measurement, so the exact same route is produced in a Vitest test and in the browser.
 *
 * The primary spine is a single straight vertical column (`layout.ts`), so a `failure` /
 * `conditional` / `async` connection that skips several ranks to reach a shared downstream step
 * (e.g. three decision steps each failing straight through to one terminal step) draws a straight
 * line directly through every intervening spine card if left to the default smoothstep renderer.
 * This module decides, per branch edge, whether its direct path would clip another node, and if
 * so produces an explicit orthogonal route that departs the source sideways into a dedicated
 * gutter lane to the right of the entire graph, runs down that lane clear of every node, then
 * re-enters the target from the side. Edges that already have a clear direct path (most adjacent
 * branches — e.g. a decision's two immediate outcomes) are left alone: routing every branch edge
 * through the gutter regardless would read as gratuitous detours, not clarity.
 *
 * A branch edge whose target is an outcome pill `layout.ts` anchored level with (or just below)
 * this edge's own source — the common case, one dedicated outcome per failure — gets a third
 * treatment: a short local "hop" straight out of the source's right side into the target's left
 * side (`buildDirectHopRoute`), never the bottom-to-top axis every other edge on the canvas uses.
 * That is only geometrically short and safe because `layout.ts` positioned the outcome to make it
 * so; an outcome several distant branches share still falls through to the gutter-lane treatment
 * above, which is the case that logic was actually built for.
 *
 * Edges that share a target merge into one lane (task guidance: "if two branches share a target,
 * they may merge into a shared lane before entering it, if that reads more cleanly") — their
 * sources are necessarily at different ranks, so their labels land at different points along the
 * same lane without needing extra bookkeeping to keep them apart.
 */
import { connectionStyle } from "../../design/semantics";
import { connectionLabelText } from "./edgeLabel";
import type { LayoutEdge, LayoutNode } from "./layout";
import { estimateLabelChipWidth } from "./nodeContent";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutedEdge {
  id: string;
  /** Ordered waypoints of an axis-aligned polyline (every consecutive pair shares either an x or
   * a y — never a diagonal). The renderer rounds the corners; the raw polyline is what routing
   * decisions and collision checks reason about. */
  points: Point[];
  /** Where this edge's label anchors — always on this edge's own lane segment, at a height that
   * tracks its own source, so concurrent branches sharing a lane never collide. */
  labelPoint: Point;
}

/**
 * Padding used when *deciding* whether a branch edge's direct path needs rerouting. Generous —
 * larger than `SIDECAR_CORNER_RADIUS` — because React Flow's own `getSmoothStepPath` (used for
 * every edge this module leaves alone) rounds its corners too: when a branch edge's source and
 * target sit in different x-columns with only one rank of vertical room between them (e.g. two
 * concurrent branches from the same fan-out landing in different columns, one nearer the spine
 * than the other), the rendered curve's rounded approach into the target can bulge into the
 * target's own rank enough to clip a nearer-column sibling sitting there — confirmed by rendering
 * this exact shape and sampling the live SVG path, not assumed. Treating that shared-rank
 * neighbour as "in the way" even though it only just touches the path's own endpoint boundary is
 * deliberately conservative: it is cheap to reroute a card that turns out to have had room, but
 * expensive to leave one clipped.
 */
const DECISION_CLEARANCE = 14;
/**
 * Padding used to verify the *already-computed* sidecar route, and the default for the exported
 * `polylineIntersectsRect`. Small — this only guards against float noise, because the route
 * itself already carves out real, deliberate margins (`TURN_INSET`, `SIBLING_AVOIDANCE_MARGIN`)
 * sized against `LAYOUT_RANK_SEP`; testing the result against the same generous
 * `DECISION_CLEARANCE` used to *trigger* rerouting would make the algorithm flag its own
 * carefully-clear route as still colliding.
 */
const COLLISION_CLEARANCE = 2;
/** How far past a same-rank sibling's true edge the departure/arrival turn is pushed when that
 * sibling is taller than the source/target itself — a real, deliberate gap (unlike
 * `COLLISION_CLEARANCE`, which only guards against float noise). */
const SIBLING_AVOIDANCE_MARGIN = 6;
/** Rounded-corner radius for the sidecar route, matching `WorkflowEdge`'s smoothstep radius so a
 * branch edge that switches from direct to sidecar routing doesn't change its corner language.
 * Safe regardless of clearance: rounding trims a corner *inward*, from each adjacent straight
 * segment toward the corner point, so it can never push the path further than the corner's own
 * (already-clear) waypoint. */
export const SIDECAR_CORNER_RADIUS = 10;
/** Gap between the rightmost extent of every node in the graph and the first sidecar lane.
 * Large enough that a label chip centred on that lane never overlaps the node column it runs
 * beside: measured against the real rendered chip (mono, `--fs-micro`, `--space-2` padding,
 * 1px border) for the longest realistic branch label ("quota exceeded", 15 chars) the label's
 * own half-width is ~54 flow units, so 40 left it clipping the neighbouring node box by a few
 * pixels — confirmed by rendering `examples/motiona`'s `generate-video` workflow and reading
 * back real `getBoundingClientRect()` values, not estimated. 64 clears that same worst case
 * with margin to spare while staying visually close to the column it annotates. */
const LANE_GAP = 64;
/** Distance between adjacent lanes — wide enough that the longest realistic label chip
 * ("quota exceeded", centred on its own lane) never reaches a neighbouring lane's line. */
const LANE_PITCH = 130;
/** How far below the source's own rank gap / above the target's own rank gap the route turns
 * onto the lane — kept comfortably under `LAYOUT_RANK_SEP` (18px, see `layout.ts`) so the turn
 * always lands inside the free band between ranks, never inside a neighbouring rank. */
const TURN_INSET = 8;
/**
 * Return edges already leave and re-enter through the connected cards' right sides. Their
 * horizontal turns therefore sit just outside those cards, at the far edges of the surrounding
 * rank gaps, rather than in the middle of each gap like bottom-to-top sidecars. This maximizes
 * clearance from the unrelated cards in the ranks immediately after the source and before the
 * target — the route stays visually continuous instead of appearing to disappear under a card.
 */
const RETURN_TURN_INSET = 1;
/** How far below its own turn-onto-the-lane point a label sits. */
const LABEL_OFFSET_Y = 11;
/** Two nodes belong to the same dagre rank when their centre-y matches to within float error. */
const RANK_ALIGN_EPSILON = 0.5;

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function segmentRect(a: Point, b: Point, clearance: number): Rect {
  const minX = Math.min(a.x, b.x) - clearance;
  const maxX = Math.max(a.x, b.x) + clearance;
  const minY = Math.min(a.y, b.y) - clearance;
  const maxY = Math.max(a.y, b.y) + clearance;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function nodeRect(node: LayoutNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

/**
 * Whether an axis-aligned polyline passes through `rect` (expanded by `clearance`). Every segment
 * of a routed edge is horizontal or vertical by construction, so a bounding-box overlap test per
 * segment is exact — not an approximation — for this shape of path. Exported so tests can assert
 * it directly against `computeEdgeRoutes`'s own output.
 */
export function polylineIntersectsRect(points: Point[], rect: Rect, clearance = COLLISION_CLEARANCE): boolean {
  const expanded: Rect = {
    x: rect.x - clearance,
    y: rect.y - clearance,
    width: rect.width + clearance * 2,
    height: rect.height + clearance * 2,
  };
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (a === undefined || b === undefined) {
      continue;
    }
    if (rectsOverlap(segmentRect(a, b, 0), expanded)) {
      return true;
    }
  }
  return false;
}

function isBranchEdge(edge: LayoutEdge): boolean {
  return connectionStyle(edge.connection.type).weight === "branch";
}

function sameRank(a: LayoutNode, b: LayoutNode): boolean {
  const centerA = a.y + a.height / 2;
  const centerB = b.y + b.height / 2;
  return Math.abs(centerA - centerB) < RANK_ALIGN_EPSILON;
}

/** Whether a straight line from `source`'s bottom-centre to `target`'s top-centre would clip any
 * other node — the same conservative bounding-box test `polylineIntersectsRect` performs, applied
 * to the two-point direct path a `WorkflowEdge` would otherwise render. */
function directPathCollides(source: LayoutNode, target: LayoutNode, others: LayoutNode[]): boolean {
  const path: Point[] = [
    { x: source.x + source.width / 2, y: source.y + source.height },
    { x: target.x + target.width / 2, y: target.y },
  ];
  return others.some((node) => polylineIntersectsRect(path, nodeRect(node), DECISION_CLEARANCE));
}

/** How far above a direct hop's own line its label sits — mirrors `LABEL_OFFSET_Y`'s role for a
 * sidecar lane label, kept as its own constant so the two can be tuned independently even though
 * they start at the same value. */
const HOP_LABEL_OFFSET_Y = 11;
/** Keeps a direct outcome hop's vertical turn inside the guaranteed-empty gap immediately before
 * the outcome column. Using the geometric midpoint can put that vertical segment through an
 * unrelated branch card when the source is several columns away. Ninety units leaves the turn
 * clear of the rightmost work card while giving the target-local segment enough room for the
 * label chip. */
const HOP_MIN_TARGET_APPROACH = 90;

/**
 * A short, local route for a branch edge whose target is a sole-feed outcome pill (see the file
 * header): out of the source's right side, straight across (or, when several outcomes stack
 * below one busy source, down-and-across) into the target's left side. Unlike every other route
 * this module produces, this one never touches the source's bottom or the target's top — those
 * belong to the vertical spine language; a sideways hop reads as "a nearby alternative result",
 * not "the next step", which is exactly the distinction an outcome pill needs to make. The label
 * lands at the midpoint of the hop, between the two nodes it connects (contract mandate: "anchor
 * each label on or immediately beside its own path").
 */
function buildDirectHopRoute(source: LayoutNode, target: LayoutNode, labelText?: string): Omit<RoutedEdge, "id"> {
  const exit: Point = { x: source.x + source.width, y: source.y + source.height / 2 };
  const enter: Point = { x: target.x, y: target.y + target.height / 2 };
  if (enter.x <= exit.x) {
    throw new Error(`Outcome direct hop must run forward (${source.id} -> ${target.id})`);
  }
  const targetApproach = Math.max(
    HOP_MIN_TARGET_APPROACH,
    labelText === undefined ? 0 : estimateLabelChipWidth(labelText) + COLLISION_CLEARANCE * 2,
  );
  const approachX = Math.max(exit.x + 1, enter.x - targetApproach);
  const points = dedupeConsecutive([exit, { x: approachX, y: exit.y }, { x: approachX, y: enter.y }, enter]);
  // Anchor on the final target-local segment: outcomes stacked from one source then receive one
  // label per row instead of every label competing for the shared departure point.
  const labelPoint: Point = { x: approachX + (enter.x - approachX) / 2, y: enter.y - HOP_LABEL_OFFSET_Y };
  return { points, labelPoint };
}

/**
 * The y at which it is safe to turn from a vertical departure onto a horizontal run toward
 * `laneX`, given every other node that shares the source's rank and whose x-range overlaps the
 * horizontal corridor between the source and the lane. A same-rank sibling taller than the source
 * (e.g. a branch-column card with a two-line purpose next to a one-line spine card) pushes the
 * turn down past its own bottom edge; dagre's rank separation guarantees this can never reach
 * into the next rank (a rank's height is defined as its tallest member, so no same-rank node's
 * bottom edge can exceed the true rank boundary the next rank's own top already respects).
 */
function clearDepartureY(
  source: LayoutNode,
  sourceX: number,
  laneX: number,
  allNodes: LayoutNode[],
  turnInset = TURN_INSET,
): number {
  const minX = Math.min(sourceX, laneX) - SIBLING_AVOIDANCE_MARGIN;
  const maxX = Math.max(sourceX, laneX) + SIBLING_AVOIDANCE_MARGIN;
  let y = source.y + source.height + turnInset;
  for (const node of allNodes) {
    if (node.id === source.id || !sameRank(node, source)) {
      continue;
    }
    const overlapsX = node.x < maxX && node.x + node.width > minX;
    if (overlapsX) {
      y = Math.max(y, node.y + node.height + SIBLING_AVOIDANCE_MARGIN);
    }
  }
  return y;
}

/** Mirror of `clearDepartureY` for the approach into the target from above. */
function clearArrivalY(
  target: LayoutNode,
  targetX: number,
  laneX: number,
  allNodes: LayoutNode[],
  turnInset = TURN_INSET,
): number {
  const minX = Math.min(targetX, laneX) - SIBLING_AVOIDANCE_MARGIN;
  const maxX = Math.max(targetX, laneX) + SIBLING_AVOIDANCE_MARGIN;
  let y = target.y - turnInset;
  for (const node of allNodes) {
    if (node.id === target.id || !sameRank(node, target)) {
      continue;
    }
    const overlapsX = node.x < maxX && node.x + node.width > minX;
    if (overlapsX) {
      y = Math.min(y, node.y - SIBLING_AVOIDANCE_MARGIN);
    }
  }
  return y;
}

function dedupeConsecutive(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last === undefined || last.x !== point.x || last.y !== point.y) {
      result.push(point);
    }
  }
  return result;
}

/**
 * Renders an axis-aligned polyline as a rounded-corner SVG path `d` string: each interior point is
 * trimmed by `radius` (clamped to half of its shorter adjacent segment) and joined with a
 * quadratic curve, mirroring the corner language `getSmoothStepPath` already uses elsewhere on the
 * canvas so a sidecar-routed edge doesn't read as a different connector language.
 */
export function buildOrthogonalPath(rawPoints: Point[], radius: number): string {
  const points = dedupeConsecutive(rawPoints);
  if (points.length < 2) {
    return "";
  }
  if (points.length === 2) {
    const [start, end] = points;
    return `M${start!.x},${start!.y} L${end!.x},${end!.y}`;
  }

  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const segIn = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const segOut = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(radius, segIn / 2, segOut / 2);
    const inPoint = movePointTowards(curr, prev, r);
    const outPoint = movePointTowards(curr, next, r);
    d += ` L${inPoint.x},${inPoint.y} Q${curr.x},${curr.y} ${outPoint.x},${outPoint.y}`;
  }
  const last = points[points.length - 1]!;
  d += ` L${last.x},${last.y}`;
  return d;
}

/** How far right of the node's own edge the retry loop bulges out. Sized to read as a
 * meaningful loop rather than card-border noise: a 46px outset sat so close to the node's own
 * right border that the curl merged with it at fit-view zoom. ~80 keeps the loop's outer curve
 * clear of the card edge while still leaving the label legible on that outer curve. */
const RETRY_LOOP_OUTSET = 80;
/** How far below the node's top edge the loop re-enters — kept well clear of the header row
 * (`StepNode.module.css`'s 24px `.header`) so the arrowhead doesn't land on top of the title. */
const RETRY_LOOP_TOP_INSET = 20;
/** Vertical fraction of the node's own height the loop departs from — comfortably below the
 * header, clear of the top-inset re-entry point above it. */
const RETRY_LOOP_EXIT_FRACTION = 0.55;

export interface RetryLoopRoute {
  /** SVG path `d` for a compact loop that departs and re-enters the *same* side of the node
   * (contract mandate: "loop edges always enter and exit on ONE designated side of the node;
   * terminal/branch exits use a DIFFERENT side" — every other edge in this renderer departs a
   * node's bottom and arrives its top, so the retry loop deliberately uses the right side
   * instead, the one side nothing else ever touches). */
  d: string;
  labelPoint: Point;
}

/**
 * Builds the local retry-loop geometry for a step that retries itself (or, more generally, any
 * detected back edge — `canvas/graph.ts`'s `computeBackEdgeIds`): a small bulge that leaves the
 * node's right edge partway down, arcs outward, and re-enters the same right edge near the top —
 * never a long line back across the canvas. Pure geometry over the node's own already-computed
 * `Rect`, so it needs nothing from the DOM and stays unit-testable like every other function here.
 */
export function buildRetryLoopPath(rect: Rect): RetryLoopRoute {
  const rightX = rect.x + rect.width;
  const exitY = rect.y + rect.height * RETRY_LOOP_EXIT_FRACTION;
  const enterY = rect.y + RETRY_LOOP_TOP_INSET;
  const bulgeX = rightX + RETRY_LOOP_OUTSET;
  const d = `M${rightX},${exitY} C${bulgeX},${exitY} ${bulgeX},${enterY} ${rightX},${enterY}`;
  return { d, labelPoint: { x: bulgeX - 2, y: (exitY + enterY) / 2 } };
}

function movePointTowards(from: Point, to: Point, distance: number): Point {
  const total = Math.hypot(to.x - from.x, to.y - from.y);
  if (total === 0) {
    return { ...from };
  }
  const t = distance / total;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/**
 * Computes an explicit route for every branch edge that needs one. A branch edge into a sole-feed
 * outcome gets a short direct hop (`buildDirectHopRoute`) whenever that hop's own path is clear;
 * everything else falls back to the collision check this module always used — a clear direct path
 * (including every `success`/primary edge — the spine never reroutes) gets no entry at all, and a
 * colliding one gets an explicit sidecar route around the graph, merging edges that share a target
 * into one lane. Returns a map keyed by edge id; `WorkflowEdge` falls back to its own smoothstep
 * rendering for any edge with no entry here.
 */
export function computeEdgeRoutes(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  backEdgeIds: ReadonlySet<string> = new Set(),
): Map<string, RoutedEdge> {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const routes = new Map<string, RoutedEdge>();
  const graphMaxX = Math.max(...nodes.map((node) => node.x + node.width));
  const workMaxX = Math.max(...nodes.filter((node) => !node.isOutcome).map((node) => node.x + node.width));
  const outcomeXs = nodes.filter((node) => node.isOutcome).map((node) => node.x);
  const outcomeMinX = outcomeXs.length > 0 ? Math.min(...outcomeXs) : undefined;

  // Self loops stay as compact renderer-side curls. Every other detected back edge gets an
  // honest return route whose arrow terminates on its real target's right edge. Prefer the empty
  // channel before the outcome column; falling back outside the full graph keeps multiple return
  // lanes deterministic without forcing a single return edge to widen the fitted viewport.
  const returnEdges = edges.filter((edge) => backEdgeIds.has(edge.id) && edge.source !== edge.target);
  let gapLaneIndex = 0;
  let externalReturnLaneCount = 0;
  returnEdges.forEach((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (source === undefined || target === undefined) return;
    const sourceRight = source.x + source.width;
    const targetRight = target.x + target.width;
    const gapLaneX = workMaxX + LANE_GAP + gapLaneIndex * LANE_PITCH;
    const labelText = connectionLabelText(edge.connection);
    const labelHalfWidth = labelText === undefined ? 0 : estimateLabelChipWidth(labelText) / 2;
    const gapLaneFits = outcomeMinX !== undefined && gapLaneX + labelHalfWidth + COLLISION_CLEARANCE < outcomeMinX;
    const laneX = gapLaneFits
      ? gapLaneX
      : graphMaxX + LANE_GAP + externalReturnLaneCount * LANE_PITCH;
    if (gapLaneFits) {
      gapLaneIndex += 1;
    } else {
      externalReturnLaneCount += 1;
    }
    const departY = clearDepartureY(source, sourceRight + TURN_INSET, laneX, nodes, RETURN_TURN_INSET);
    const arriveY = clearArrivalY(target, targetRight + TURN_INSET, laneX, nodes, RETURN_TURN_INSET);
    const points = dedupeConsecutive([
      { x: sourceRight, y: source.y + source.height / 2 },
      { x: sourceRight + TURN_INSET, y: source.y + source.height / 2 },
      { x: sourceRight + TURN_INSET, y: departY },
      { x: laneX, y: departY },
      { x: laneX, y: arriveY },
      { x: targetRight + TURN_INSET, y: arriveY },
      { x: targetRight + TURN_INSET, y: target.y + target.height / 2 },
      { x: targetRight, y: target.y + target.height / 2 },
    ]);
    routes.set(edge.id, { id: edge.id, points, labelPoint: { x: laneX, y: (departY + arriveY) / 2 } });
  });

  // How many valid connections land on each node — the signal that tells a sole-feed outcome
  // (this edge is its only incoming connection, so `layout.ts` anchored the outcome's position to
  // this edge's own source) apart from a shared outcome several distant branches converge on
  // (still routed through the gutter lane below, the case that logic was actually built for).
  const incomingCountByTarget = new Map<string, number>();
  for (const edge of edges) {
    incomingCountByTarget.set(edge.target, (incomingCountByTarget.get(edge.target) ?? 0) + 1);
  }

  const needsSidecar: LayoutEdge[] = [];
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (source === undefined || target === undefined || source.id === target.id) {
      continue;
    }
    if (backEdgeIds.has(edge.id)) {
      continue;
    }
    const others = nodes.filter((node) => node.id !== source.id && node.id !== target.id);

    // A sole-feed outcome gets the direct hop regardless of this edge's own weight: `layout.ts`
    // positions it beside its one source whether that connection is a `success` (e.g. "Save
    // Result --success--> 201 Created", drawn as a short horizontal primary line) or a branch —
    // either way, a level-with-source target calls for a sideways hop, not the vertical
    // bottom-to-top axis a same-column successor uses.
    const isSoleOutcomeFeed = target.isOutcome && incomingCountByTarget.get(target.id) === 1;
    if (isSoleOutcomeFeed) {
      const hop = buildDirectHopRoute(source, target, connectionLabelText(edge.connection));
      const hopCollides = others.some((node) => polylineIntersectsRect(hop.points, nodeRect(node), DECISION_CLEARANCE));
      if (!hopCollides) {
        routes.set(edge.id, { id: edge.id, ...hop });
        continue;
      }
      // The local hop would clip something (an unusually cramped outcome column). A branch edge
      // can still fall through to the gutter-lane treatment below; a primary edge never reroutes
      // (the spine's own invariant), so it simply renders unrouted rather than force a colliding
      // shortcut.
    }

    if (!isBranchEdge(edge)) {
      continue;
    }
    if (directPathCollides(source, target, others)) {
      needsSidecar.push(edge);
    }
  }

  if (needsSidecar.length === 0) {
    return routes;
  }

  const groupsByTarget = new Map<string, LayoutEdge[]>();
  for (const edge of needsSidecar) {
    const list = groupsByTarget.get(edge.target) ?? [];
    list.push(edge);
    groupsByTarget.set(edge.target, list);
  }

  interface GroupInfo {
    targetId: string;
    edges: LayoutEdge[];
    minY: number;
    maxY: number;
  }
  const groups: GroupInfo[] = [];
  for (const [targetId, groupEdges] of groupsByTarget) {
    const target = byId.get(targetId)!;
    let minY = target.y;
    let maxY = target.y;
    for (const edge of groupEdges) {
      const source = byId.get(edge.source)!;
      minY = Math.min(minY, source.y + source.height);
      maxY = Math.max(maxY, source.y + source.height);
    }
    groups.push({ targetId, edges: groupEdges, minY, maxY });
  }
  // Deterministic processing order regardless of Map iteration order (which follows first
  // appearance in `edges`, itself `workflow.connections` order — already deterministic, but
  // sorting explicitly by vertical position then id keeps lane *assignment* independent of
  // connection declaration order too).
  groups.sort((a, b) => a.minY - b.minY || a.targetId.localeCompare(b.targetId));

  // Greedy interval-graph colouring: reuse a lane once its previous occupant's extent ends
  // before this group starts (with clearance), otherwise open a new lane.
  const laneOccupiedUntil: number[] = [];
  const laneIndexByTarget = new Map<string, number>();
  for (const group of groups) {
    let laneIndex = laneOccupiedUntil.findIndex((occupiedUntil) => occupiedUntil < group.minY - SIBLING_AVOIDANCE_MARGIN);
    if (laneIndex === -1) {
      laneIndex = laneOccupiedUntil.length;
      laneOccupiedUntil.push(group.maxY);
    } else {
      laneOccupiedUntil[laneIndex] = group.maxY;
    }
    laneIndexByTarget.set(group.targetId, laneIndex);
  }

  for (const group of groups) {
    const laneIndex = laneIndexByTarget.get(group.targetId)!;
    const laneX = graphMaxX + LANE_GAP + (externalReturnLaneCount + laneIndex) * LANE_PITCH;
    const target = byId.get(group.targetId)!;
    const targetX = target.x + target.width / 2;
    const targetTopY = target.y;

    for (const edge of group.edges) {
      const source = byId.get(edge.source)!;
      const sourceX = source.x + source.width / 2;
      const sourceBottomY = source.y + source.height;

      const departY = clearDepartureY(source, sourceX, laneX, nodes);
      const arriveY = clearArrivalY(target, targetX, laneX, nodes);
      const laneSpan = arriveY - departY;
      const labelY = laneSpan > LABEL_OFFSET_Y * 2 ? departY + LABEL_OFFSET_Y : departY + laneSpan / 2;

      const points: Point[] = [
        { x: sourceX, y: sourceBottomY },
        { x: sourceX, y: departY },
        { x: laneX, y: departY },
        { x: laneX, y: arriveY },
        { x: targetX, y: arriveY },
        { x: targetX, y: targetTopY },
      ];

      routes.set(edge.id, { id: edge.id, points, labelPoint: { x: laneX, y: labelY } });
    }
  }

  return routes;
}
