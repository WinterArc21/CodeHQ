import { useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { ApiError, getSource } from "../../api/client";
import { Button, CopyButton, MonoPath } from "../primitives";
import { DiagnosticsIssueRow } from "./DiagnosticsIssueRow";
import type { DiagnosticsFileGroup as DiagnosticsFileGroupData } from "./groupIssues";
import styles from "./DiagnosticsFileGroup.module.css";

export interface DiagnosticsFileGroupProps {
  group: DiagnosticsFileGroupData;
}

function countLabel(group: DiagnosticsFileGroupData): string {
  const parts: string[] = [];
  if (group.errorCount > 0) {
    parts.push(`${group.errorCount} ${group.errorCount === 1 ? "error" : "errors"}`);
  }
  if (group.warningCount > 0) {
    parts.push(`${group.warningCount} ${group.warningCount === 1 ? "warning" : "warnings"}`);
  }
  return parts.join(", ");
}

/**
 * All issues for one file, grouped under a header that offers the same real, working actions as
 * a step drawer's source references (contract §12: no fake buttons) — `/api/source` resolves any
 * repository-relative path, including the invalid workflow file itself, so "Open in editor"
 * jumps straight to the file.
 */
export function DiagnosticsFileGroup({ group }: DiagnosticsFileGroupProps) {
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const handleOpen = async (): Promise<void> => {
    setOpening(true);
    setOpenError(null);
    try {
      const lookup = await getSource(group.file);
      if (!lookup.exists) {
        setOpenError(`${lookup.file} was not found in this repository.`);
        return;
      }
      if (lookup.editorUrl === undefined) {
        setOpenError("The server did not return an editor link for this file.");
        return;
      }
      window.location.href = lookup.editorUrl;
    } catch (error) {
      setOpenError(error instanceof ApiError ? error.message : "Could not reach the HQ server.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className={styles.group} aria-label={group.file}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <MonoPath path={group.file} maxChars={64} />
          <span className={styles.count}>{countLabel(group)}</span>
        </div>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowSquareOut size={14} />}
            onClick={() => void handleOpen()}
            disabled={opening}
          >
            Open in editor
          </Button>
          <CopyButton value={group.file} label="Copy path" />
        </div>
      </div>
      {openError !== null ? (
        <p className={styles.error} role="alert">
          {openError}
        </p>
      ) : null}
      <ul className={styles.issues}>
        {group.issues.map((issue, index) => (
          <DiagnosticsIssueRow key={`${issue.severity}-${issue.path ?? "file"}-${index}`} issue={issue} />
        ))}
      </ul>
    </section>
  );
}
