import type { CSSProperties } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { connectionStyle } from "../../../design/semantics";
import type { WorkflowFlowEdge } from "../types";
import { edgeMarkerId } from "./EdgeMarkers";
import styles from "./WorkflowEdge.module.css";

/** Rounded-corner radius for the smoothstep routing — gentle enough to read cleanly in an
 * LR layout without the sharp right angles of a plain step path. */
const EDGE_BORDER_RADIUS = 8;
const EDGE_STROKE_WIDTH = 1.5;

const DASH_PATTERNS: Record<"dashed" | "dotted", string> = {
  dashed: "6 4",
  dotted: "1 4",
};

/**
 * A thin, directional connector styled entirely from `connectionStyle` (contract §10): neutral
 * solid for success/default, muted red dashed for failure, amber dashed with its label always
 * shown for conditional, neutral dotted for async. The label — when either `label` or
 * `condition` is present — is a small mono chip placed at the path's midpoint via
 * `EdgeLabelRenderer`, with its own background so it stays legible over the canvas grid.
 */
export function WorkflowEdge({ data, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }: EdgeProps<WorkflowFlowEdge>) {
  if (data === undefined) {
    return null;
  }

  const { connection } = data;
  const visual = connectionStyle(connection.type);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: EDGE_BORDER_RADIUS,
  });

  const edgeStyle: CSSProperties = { stroke: `var(${visual.varName})`, strokeWidth: EDGE_STROKE_WIDTH };
  if (visual.dash !== "none") {
    edgeStyle.strokeDasharray = DASH_PATTERNS[visual.dash];
  }

  const labelText = connection.label ?? connection.condition;
  const showLabel = labelText !== undefined && labelText.trim().length > 0;

  return (
    <>
      <BaseEdge path={path} markerEnd={`url(#${edgeMarkerId(connection.type)})`} style={edgeStyle} />
      {showLabel ? (
        <EdgeLabelRenderer>
          <div
            className={styles.label}
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
