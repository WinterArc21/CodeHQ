import { X } from "@phosphor-icons/react";
import type { WorkflowStep } from "@schema/workflow";
import { categoryToken } from "../../design/semantics";
import { IconButton } from "../primitives";
import styles from "./StepDrawerHeader.module.css";

export interface StepDrawerHeaderProps {
  step: WorkflowStep;
  stepIndex: number;
  stepCount: number;
  workflowName: string;
  titleId: string;
  onClose: () => void;
}

/** The drawer's top block: step position, name, workflow context, category, and purpose. */
export function StepDrawerHeader({ step, stepIndex, stepCount, workflowName, titleId, onClose }: StepDrawerHeaderProps) {
  const category = categoryToken(step.category);

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <span className={styles.eyebrow}>
          Step {stepIndex + 1} of {stepCount} &middot; {workflowName}
        </span>
        <IconButton label="Close step details" icon={<X size={16} />} size="sm" onClick={onClose} />
      </div>
      <h2 id={titleId} className={styles.title} style={{ borderLeftColor: `var(${category.varName})` }}>
        {step.name}
      </h2>
      <p className={styles.purpose}>{step.purpose}</p>
    </header>
  );
}
