import type { Workflow } from "@schema/workflow";
import { categoryToken, confidenceStyle } from "../design/semantics";
import { Badge, SectionLabel } from "./primitives";
import styles from "./StepsPreview.module.css";

export interface StepsPreviewProps {
  workflow: Workflow;
}

/**
 * Honest stand-in for the Wave 3 React Flow canvas + step drawer: a compact, real textual
 * list of the selected workflow's steps, with the same category/confidence markers the canvas
 * will eventually render as node styling (contract §10's semantic mapping, not re-derived).
 */
export function StepsPreview({ workflow }: StepsPreviewProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <SectionLabel as="h2">{workflow.name}</SectionLabel>
        <p className={styles.purpose}>{workflow.purpose}</p>
        <p className={styles.note}>Shown as a step list until the interactive canvas ships in Wave 3.</p>
      </div>
      <ol className={styles.steps}>
        {workflow.steps.map((step, index) => {
          const category = categoryToken(step.category);
          const confidence = confidenceStyle(step.confidence);
          return (
            <li key={step.id} className={styles.step} style={{ borderLeftColor: `var(${category.varName})` }}>
              <div className={styles.stepHeader}>
                <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.stepName}>{step.name}</span>
                <Badge tone="neutral">{category.label}</Badge>
                <Badge tone="neutral" dashed={confidence.marker === "dashed"} dot={confidence.marker === "solid-dot"}>
                  {confidence.label}
                </Badge>
              </div>
              <p className={styles.stepPurpose}>{step.purpose}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
