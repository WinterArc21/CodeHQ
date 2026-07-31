import type { WorkflowStep } from "@schema/workflow";
import type { Depth } from "../../../store/useObservatoryStore";
import { MAX_MODULE_ROWS, MAX_SYMBOL_ROWS, splitPath, stepModuleFiles, stepSymbolRows } from "../nodeContent";
import styles from "./StepNode.module.css";

export interface StepNodeDetailProps {
  step: WorkflowStep;
  /** The step's own effective depth (global depth, or `"symbols"` when this step is expanded). */
  depth: Depth;
}

/**
 * The part of a `StepNode` that only appears at Code map (`modules`) or per-step expand
 * (`symbols`) — Story altitude stays narrative-only (contract §11 progressive depth: same
 * node, it grows). `symbols` supersedes `modules`: a file → symbol row already names its
 * file, so showing the plain file list underneath it would just repeat information the
 * deeper view already gives.
 */
export function StepNodeDetail({ step, depth }: StepNodeDetailProps) {
  if (depth === "modules") {
    const files = stepModuleFiles(step);
    if (files.length === 0) {
      return null;
    }
    const shown = files.slice(0, MAX_MODULE_ROWS);
    const more = files.length - shown.length;
    return (
      <div className={styles.detail}>
        <span className={styles.sectionLabel}>Files</span>
        {shown.map((file) => {
          const { dir, base } = splitPath(file);
          return (
            <div key={file} className={styles.fileRow} title={file}>
              <span className={styles.dir}>{dir}</span>
              <span className={styles.base}>{base}</span>
            </div>
          );
        })}
        {more > 0 ? <div className={styles.more}>+{more} more</div> : null}
      </div>
    );
  }

  if (depth === "symbols") {
    const rows = stepSymbolRows(step);
    if (rows.length === 0) {
      return null;
    }
    const shown = rows.slice(0, MAX_SYMBOL_ROWS);
    const more = rows.length - shown.length;
    return (
      <div className={styles.detail}>
        <span className={styles.sectionLabel}>Symbols</span>
        {shown.map((row) => {
          const { dir, base } = splitPath(row.file);
          return (
            <div key={`${row.file}#${row.symbol ?? ""}`} className={styles.symbolRow} title={row.file}>
              <span className={styles.dir}>{dir}</span>
              <span className={styles.base}>{base}</span>
              {row.symbol !== undefined ? <span className={styles.symbol}>{` → ${row.symbol}()`}</span> : null}
            </div>
          );
        })}
        {more > 0 ? <div className={styles.more}>+{more} more</div> : null}
      </div>
    );
  }

  return null;
}
