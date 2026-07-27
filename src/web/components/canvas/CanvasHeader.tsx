import type { Workflow } from "@schema/workflow";
import { statusTone } from "../../design/semantics";
import { Badge } from "../primitives";
import { CanvasToolbar, type CanvasToolbarProps } from "./CanvasToolbar";
import styles from "./CanvasHeader.module.css";

export interface CanvasHeaderProps extends CanvasToolbarProps {
  workflow: Workflow;
}

/**
 * The canvas's own title strip (contract §10.4: "a quiet, useful workflow header ... so the
 * canvas explains itself") — the workflow's name, one-line purpose, status, and step count on
 * the left, the instrument's controls (depth, zoom, fit, collapse) on the right. Replaces the
 * old floating `<Panel position="top-left">` toolbar, which read as an orphan disconnected from
 * the rest of the frame; this bar is now a fixed part of the canvas's own chrome, the same way a
 * drawing has a title block.
 */
export function CanvasHeader({ workflow, ...toolbarProps }: CanvasHeaderProps) {
  const status = statusTone(workflow.status);

  return (
    <div className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.titleRow}>
          <h1 className={styles.name}>{workflow.name}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className={styles.stepCount}>{workflow.steps.length} steps</span>
        </div>
        <p className={styles.purpose}>{workflow.purpose}</p>
      </div>
      <CanvasToolbar {...toolbarProps} />
    </div>
  );
}
