import type { Workflow } from "@schema/workflow";
import { CanvasToolbar, type CanvasToolbarProps } from "./CanvasToolbar";
import styles from "./CanvasHeader.module.css";

export interface CanvasHeaderProps extends CanvasToolbarProps {
  workflow: Workflow;
}

/** The canvas title strip and its remaining zoom/collapse actions. */
export function CanvasHeader({ workflow, ...toolbarProps }: CanvasHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.titleRow}>
          <h1 className={styles.name}>{workflow.name}</h1>
          <span className={styles.stepCount}>{workflow.steps.length} steps</span>
        </div>
        <p className={styles.purpose}>{workflow.purpose}</p>
      </div>
      <CanvasToolbar {...toolbarProps} />
    </div>
  );
}
