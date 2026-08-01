import type { NodeProps } from "@xyflow/react";
import type { ZoneLabelFlowNode } from "../types";
import styles from "./ZoneLabel.module.css";

/**
 * A quiet "MAIN LINE" / "OUTCOMES" region header (mockup: `prototypes/edge-grammar`) sitting
 * above each column — purely decorative orientation text, not a graph node: no handles, no
 * interaction, excluded from path tracing, keyboard navigation, and the minimap's node count
 * (`WorkflowCanvas.tsx` only counts `type === "step"`). Rendered as a real React Flow node rather
 * than a fixed overlay specifically so it pans and zooms with the graph it's labelling instead of
 * drifting out of alignment with it.
 */
export function ZoneLabel({ data }: NodeProps<ZoneLabelFlowNode>) {
  const className = [styles.label, data.dimmed ? styles.dimmed : ""].filter(Boolean).join(" ");

  return (
    <span className={className} aria-hidden="true">
      {data.text}
    </span>
  );
}
