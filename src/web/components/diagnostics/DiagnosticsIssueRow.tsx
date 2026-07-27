import type { Issue } from "@schema/diagnostics";
import { Badge } from "../primitives";
import styles from "./DiagnosticsIssueRow.module.css";

export interface DiagnosticsIssueRowProps {
  issue: Issue;
}

/**
 * One `Issue`: severity (label, never colour alone), the JSON-pointer-ish `path` in mono, the
 * message, and the hint on its own dimmed line — every field the schema defines, because these
 * are exactly what a human or a repairing agent acts on (contract §6).
 */
export function DiagnosticsIssueRow({ issue }: DiagnosticsIssueRowProps) {
  return (
    <li className={styles.row}>
      <div className={styles.headerLine}>
        <Badge tone={issue.severity === "error" ? "red" : "amber"}>
          {issue.severity === "error" ? "Error" : "Warning"}
        </Badge>
        {issue.path !== undefined ? <span className={styles.path}>{issue.path}</span> : null}
      </div>
      <p className={styles.message}>{issue.message}</p>
      {issue.hint !== undefined ? <p className={styles.hint}>{issue.hint}</p> : null}
    </li>
  );
}
