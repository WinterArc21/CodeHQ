import type { CSSProperties } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { connectionStyle, type ConnectionVisual } from "../../../design/semantics";
import { buildOrthogonalPath, SIDECAR_CORNER_RADIUS } from "../edgeRouting";
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

/** Stroke width per weight (contract §10.3: the primary path must read as visually dominant,
 * branches as clearly subordinate but legible — never invisible). */
const STROKE_WIDTH: Record<ConnectionVisual["weight"], number> = {
  primary: 2,
  branch: 1.25,
};

/** How far below the source node's own edge a label sits — small enough to land inside the gap
 * between ranks (`layout.ts`'s `LAYOUT_RANK_SEP`) rather than drifting onto whatever step is
 * next. A branch connection on the spine layout commonly skips several ranks to reach a shared
 * downstream step (e.g. three different decision steps all failing through to the same terminal
 * step); the path's geometric *midpoint* then lands wherever that shared target happens to be
 * relative to every source, pulling otherwise-unrelated labels toward the same patch of canvas
 * and reading as clutter instead of three distinct annotations (contract mandate: "anchor each
 * label on or immediately beside its own path ... ensure the three never collide"). Anchoring to
 * the source's own y instead keeps every label pinned to the step it actually describes. */
const LABEL_Y_OFFSET_FROM_SOURCE = 9;
/** How far horizontally to blend a label from the source's x toward the target's x. Two branch
 * connections that share one source but diverge to different targets (e.g. a scan step's "clean"
 * and "flagged" outcomes) would otherwise both anchor at the same point right below their shared
 * source; blending partway toward each one's own target x pulls them apart along the same axis
 * their paths actually diverge on, so they read as two distinct lines, not a stacked pair. */
const LABEL_X_BLEND_TOWARD_TARGET = 0.5;

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
export function WorkflowEdge({ id, data, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }: EdgeProps<WorkflowFlowEdge>) {
  if (data === undefined) {
    return null;
  }

  const { connection, route } = data;
  const visual = connectionStyle(connection.type);
  const path =
    route !== undefined
      ? buildOrthogonalPath(route.points, SIDECAR_CORNER_RADIUS)
      : getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: EDGE_BORDER_RADIUS })[0];

  const edgeStyle: CSSProperties = {
    stroke: `var(${visual.varName})`,
    strokeWidth: STROKE_WIDTH[visual.weight],
    opacity: visual.weight === "branch" ? 0.85 : 1,
  };
  if (visual.dash !== "none") {
    edgeStyle.strokeDasharray = DASH_PATTERNS[visual.dash];
  }

  const labelText = connection.label ?? connection.condition;
  const showLabel = labelText !== undefined && labelText.trim().length > 0;
  const labelX = route !== undefined ? route.labelPoint.x : sourceX + (targetX - sourceX) * LABEL_X_BLEND_TOWARD_TARGET;
  const labelY = route !== undefined ? route.labelPoint.y : sourceY + LABEL_Y_OFFSET_FROM_SOURCE;

  return (
    <>
      <BaseEdge path={path} markerEnd={`url(#${edgeMarkerId(connection.type)})`} style={edgeStyle} />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            className={styles.label}
            data-edge-label={id}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: `var(${visual.varName})`,
            }}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
