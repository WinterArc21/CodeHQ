import type { CSSProperties } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { connectionStyle, RETRY_EDGE_VISUAL } from "../../../design/semantics";
import { connectionLabelText, LABEL_X_BLEND_TOWARD_TARGET, LABEL_Y_OFFSET_FROM_SOURCE } from "../edgeLabel";
import { buildOrthogonalPath, buildRetryLoopPath, SIDECAR_CORNER_RADIUS } from "../edgeRouting";
import type { WorkflowFlowEdge } from "../types";
import { edgeMarkerId } from "./EdgeMarkers";
import styles from "./WorkflowEdge.module.css";

/** Rounded-corner radius for the smoothstep routing — gentle enough to read cleanly in a
 * top-to-bottom layout without the sharp right angles of a plain step path. */
const EDGE_BORDER_RADIUS = 10;

/** Stroke width per connection type (contract §10.3 / edge-grammar table: normal sync flow is
 * "solid, strongest weight"; every branch — conditional, failure, async, retry — reads as clearly
 * subordinate but still legible, never invisible). Keyed by the same discriminator the marker
 * uses (`markerVariant`: the connection `type`, or `"retry"` for a self-loop), so the line and its
 * arrowhead always share one grammar entry. Async reads slightly heavier than the other branches
 * because its rounded-bead dashing otherwise thins the perceived line. */
function edgeStrokeWidth(variant: string): number {
  switch (variant) {
    case "success":
      return 2.5;
    case "async":
      return 2.25;
    case "failure":
    case "conditional":
    case "retry":
      return 2;
    default:
      return 2.5;
  }
}

const DASH_PATTERNS: Record<"dashed" | "dotted", string> = {
  dashed: "7 5",
  dotted: "1 5",
};

/** How much wider than the semantic stroke the background-coloured casing/halo paints — a solid
 * underlay that carves the dashed line clear of the canvas grid and neighbouring card borders
 * without introducing a neon outline. The halo follows the same path shape (dashes are preserved
 * on the semantic stroke on top); only its width grows. */
const HALO_WIDTH_PADDING = 3;
/** How much a traced edge's stroke grows when path tracing is active (contract §11): tracing must
 * not only dim unrelated paths, it must also strengthen the path the user is following, so the
 * traced line reads as the figure rather than merely the ground. Kept under the next weight tier
 * so hierarchy is reinforced, not flattened. */
const TRACED_STROKE_BOOST = 0.6;
/** Opacity applied to a dimmed edge during path tracing (contract §11) — a dimmed edge fades to a
 * quiet background tone while traced edges strengthen, so the followed path reads as the figure. */
const DIMMED_OPACITY_FACTOR = 0.3;

/**
 * A thin, directional connector styled entirely from `connectionStyle` (contract §10): neutral
 * solid for success/default, muted red dashed for failure, amber dashed with its label always
 * shown for conditional, neutral dotted for async. The primary path renders bolder than a
 * branch so a reader can trace "what happens next" without consciously parsing colour.
 *
 * A branch edge whose direct path would clip an intervening spine card carries a pre-computed
 * `data.route` (`edgeRouting.ts`) — an explicit sidecar path around the graph instead of the
 * smoothstep curve every other edge uses, so "what happens when this fails" stays traceable
 * instead of running invisibly through the cards in between. The label — when either `label` or
 * `condition` is present — is a small mono chip with its own opaque background so it stays
 * legible over the canvas grid, anchored near the connection's own source point (a routed edge
 * anchors on its own lane segment instead; see `route.labelPoint`).
 */
export function WorkflowEdge({ id, data, source, target, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }: EdgeProps<WorkflowFlowEdge>) {
  if (data === undefined) {
    return null;
  }

  const { connection, route, retryLoop, dimmed, traced } = data;
  const isRetryLoop = retryLoop !== undefined;
  const visual = isRetryLoop ? RETRY_EDGE_VISUAL : connectionStyle(connection.type);
  const markerVariant = isRetryLoop ? "retry" : connection.type;

  let path: string;
  let labelX: number;
  let labelY: number;
  if (retryLoop !== undefined) {
    const loop = buildRetryLoopPath(retryLoop);
    path = loop.d;
    labelX = loop.labelPoint.x;
    labelY = loop.labelPoint.y;
  } else if (route !== undefined) {
    path = buildOrthogonalPath(route.points, SIDECAR_CORNER_RADIUS);
    labelX = route.labelPoint.x;
    labelY = route.labelPoint.y;
  } else {
    path = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: EDGE_BORDER_RADIUS })[0];
    labelX = sourceX + (targetX - sourceX) * LABEL_X_BLEND_TOWARD_TARGET;
    labelY = sourceY + LABEL_Y_OFFSET_FROM_SOURCE;
  }

  const baseStrokeWidth = edgeStrokeWidth(markerVariant ?? "success");
  const strokeWidth = baseStrokeWidth + (traced ? TRACED_STROKE_BOOST : 0);
  const opacity = dimmed ? DIMMED_OPACITY_FACTOR : 1;
  const edgeTransition = "opacity var(--dur-fast) var(--ease-standard), stroke-width var(--dur-fast) var(--ease-standard)";
  const edgeStyle: CSSProperties = {
    stroke: `var(${visual.varName})`,
    strokeWidth,
    opacity,
    transition: edgeTransition,
  };
  if (visual.dash === "dotted") {
    // Async reads as rounded beads: a 1-unit dash with round line-caps becomes a dot whose
    // diameter is the stroke width, spaced every 5 units — a continuous-looking bead chain
    // rather than the brittle pixel stipple a butt-capped "1 5" would render.
    edgeStyle.strokeDasharray = DASH_PATTERNS.dotted;
    edgeStyle.strokeLinecap = "round";
  } else if (visual.dash === "dashed") {
    edgeStyle.strokeDasharray = DASH_PATTERNS.dashed;
  }

  // The casing/halo: a solid background-coloured underlay ~3px wider than the semantic stroke,
  // painted beneath the dashed line so dashes and shape are preserved on top. It separates the
  // edge from the canvas grid and card borders without a neon outline. It carries the same
  // opacity/transition as the semantic stroke so a dimmed edge's halo fades with it, and it never
  // captures pointer events (edges are not interactive; nodes drive path tracing).
  const haloStyle: CSSProperties = {
    stroke: "var(--bg-canvas)",
    strokeWidth: strokeWidth + HALO_WIDTH_PADDING,
    opacity,
    transition: edgeTransition,
    pointerEvents: "none",
  };

  const labelText = isRetryLoop ? (connectionLabelText(connection) ?? "retry") : connectionLabelText(connection);
  const showLabel = labelText !== undefined;

  return (
    <>
      <g data-workflow-edge={id} data-edge-source={source} data-edge-target={target}>
        <path d={path} fill="none" style={haloStyle} />
        <BaseEdge path={path} markerEnd={`url(#${edgeMarkerId(markerVariant)})`} style={edgeStyle} />
      </g>
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            className={styles.label}
            data-edge-label={id}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: `var(${visual.varName})`,
              opacity: dimmed ? DIMMED_OPACITY_FACTOR : 1,
              transition: "opacity var(--dur-fast) var(--ease-standard)",
            }}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
