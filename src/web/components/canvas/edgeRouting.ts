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
 * Edges that share a target merge into one lane (task guidance: "if two branches share a target,
 * they may merge into a shared lane before entering it, if that reads more cleanly") — their
 * sources are necessarily at different ranks, so their labels land at different points along the
 * same lane without needing extra bookkeeping to keep them apart.
 */
import { connectionStyle } from "../../design/semantics";
import type { LayoutEdge, LayoutNode } from "./layout";

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
/** Gap between the rightmost extent of every node in the graph and the first sidecar lane. */
const LANE_GAP = 40;
/** Distance between adjacent lanes — wide enough that the longest realistic label chip
 * ("quota exceeded", centred on its own lane) never reaches a neighbouring lane's line. */
const LANE_PITCH = 130;
/** How far below the source's own rank gap / above the target's own rank gap the route turns
 * onto the lane — kept comfortably under `LAYOUT_RANK_SEP` (18px, see `layout.ts`) so the turn
 * always lands inside the free band between ranks, never inside a neighbouring rank. */
const TURN_INSET = 8;
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

/**
 * The y at which it is safe to turn from a vertical departure onto a horizontal run toward
 * `laneX`, given every other node that shares the source's rank and whose x-range overlaps the
 * horizontal corridor between the source and the lane. A same-rank sibling taller than the source
 * (e.g. a branch-column card with a two-line purpose next to a one-line spine card) pushes the
 * turn down past its own bottom edge; dagre's rank separation guarantees this can never reach
 * into the next rank (a rank's height is defined as its tallest member, so no same-rank node's
 * bottom edge can exceed the true rank boundary the next rank's own top already respects).
 */
function clearDepartureY(source: LayoutNode, sourceX: number, laneX: number, allNodes: LayoutNode[]): number {
  const minX = Math.min(sourceX, laneX) - SIBLING_AVOIDANCE_MARGIN;
  const maxX = Math.max(sourceX, laneX) + SIBLING_AVOIDANCE_MARGIN;
  let y = source.y + source.height + TURN_INSET;
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
function clearArrivalY(target: LayoutNode, targetX: number, laneX: number, allNodes: LayoutNode[]): number {
  const minX = Math.min(targetX, laneX) - SIBLING_AVOIDANCE_MARGIN;
  const maxX = Math.max(targetX, laneX) + SIBLING_AVOIDANCE_MARGIN;
  let y = target.y - TURN_INSET;
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

function movePointTowards(from: Point, to: Point, distance: number): Point {
  const total = Math.hypot(to.x - from.x, to.y - from.y);
  if (total === 0) {
    return { ...from };
  }
  const t = distance / total;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/**
 * Computes a sidecar route for every branch edge whose direct path would clip another node,
 * merging edges that share a target into one lane. Returns a map keyed by edge id; an edge with a
 * clear direct path (including every `success`/primary edge — the spine never reroutes) simply
 * has no entry, and `WorkflowEdge` falls back to its existing smoothstep rendering for it.
 */
export function computeEdgeRoutes(nodes: LayoutNode[], edges: LayoutEdge[]): Map<string, RoutedEdge> {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const routes = new Map<string, RoutedEdge>();

  const needsSidecar: LayoutEdge[] = [];
  for (const edge of edges) {
    if (!isBranchEdge(edge)) {
      continue;
    }
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (source === undefined || target === undefined || source.id === target.id) {
      continue;
    }
    const others = nodes.filter((node) => node.id !== source.id && node.id !== target.id);
    if (directPathCollides(source, target, others)) {
      needsSidecar.push(edge);
    }
  }

  if (needsSidecar.length === 0) {
    return routes;
  }

  const graphMaxX = Math.max(...nodes.map((node) => node.x + node.width));

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
    const laneX = graphMaxX + LANE_GAP + laneIndex * LANE_PITCH;
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
