import type { CSSProperties } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { connectionStyle, RETRY_EDGE_VISUAL, type ConnectionVisual } from "../../../design/semantics";
import { connectionLabelText, LABEL_X_BLEND_TOWARD_TARGET, LABEL_Y_OFFSET_FROM_SOURCE } from "../edgeLabel";
import { buildOrthogonalPath, buildRetryLoopPath, SIDECAR_CORNER_RADIUS } from "../edgeRouting";
import type { WorkflowFlowEdge } from "../types";
import { edgeMarkerId } from "./EdgeMarkers";
import styles from "./WorkflowEdge.module.css";

/** Rounded-corner radius for the smoothstep routing — gentle enough to read cleanly in a
 * top-to-bottom layout without the sharp right angles of a plain step path. */
const EDGE_BORDER_RADIUS = 10;

const DASH_PATTERNS: Record<"dashed" | "dotted", string> = {
  dashed: "6 4",
  dotted: "1.5 4",
};

/** Stroke width per weight (contract §10.3 / edge-grammar table: normal sync flow is "solid,
 * strongest weight"; every branch — conditional, failure, async, retry — reads as clearly
 * subordinate but still legible, never invisible). */
const STROKE_WIDTH: Record<ConnectionVisual["weight"], number> = {
  primary: 2.25,
  branch: 1.25,
};
/** Opacity applied on top of a dimmed edge's own weight-based opacity (contract §11 path
 * tracing) — multiplicative, so a dimmed branch edge (already 0.85) still reads as visibly
 * fainter than a dimmed primary edge, preserving the same relative hierarchy while both fade. */
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

  const { connection, route, retryLoop, dimmed } = data;
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

  const baseOpacity = visual.weight === "branch" ? 0.85 : 1;
  const edgeStyle: CSSProperties = {
    stroke: `var(${visual.varName})`,
    strokeWidth: STROKE_WIDTH[visual.weight],
    opacity: dimmed ? baseOpacity * DIMMED_OPACITY_FACTOR : baseOpacity,
    transition: "opacity var(--dur-fast) var(--ease-standard)",
  };
  if (visual.dash !== "none") {
    edgeStyle.strokeDasharray = DASH_PATTERNS[visual.dash];
  }

  const labelText = isRetryLoop ? (connectionLabelText(connection) ?? "retry") : connectionLabelText(connection);
  const showLabel = labelText !== undefined;

  return (
    <>
      <g data-workflow-edge={id} data-edge-source={source} data-edge-target={target}>
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
