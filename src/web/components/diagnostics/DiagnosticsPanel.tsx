import { useId, useMemo, useRef } from "react";
import { CheckCircle, X } from "@phosphor-icons/react";
import type { DiagnosticsReport } from "@schema/diagnostics";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { formatRelativeTime } from "../../lib/relativeTime";
import { useFocusTrap } from "../../lib/useFocusTrap";
import { Button, IconButton } from "../primitives";
import { DiagnosticsFileGroup } from "./DiagnosticsFileGroup";
import { groupIssuesByFile, summarizeIssues } from "./groupIssues";
import styles from "./DiagnosticsPanel.module.css";

export interface DiagnosticsPanelProps {
  diagnostics: DiagnosticsReport;
  onClose: () => void;
  onRecheck: () => Promise<void>;
}

/**
 * The real diagnostics panel (contract §6, MVP scope item 13). Always mounted only while
 * `diagnosticsOpen` is true (same pattern as `StepDrawer`), grouped by file with errors before
 * warnings, and openable even when everything is valid so "Diagnostics" is never a dead end.
 */
export function DiagnosticsPanel({ diagnostics, onClose, onRecheck }: DiagnosticsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(containerRef, onClose);
  const recheck = useAsyncAction(onRecheck);

  const groups = useMemo(() => groupIssuesByFile(diagnostics.issues), [diagnostics.issues]);
  const summary = summarizeIssues(diagnostics.issues);
  const generatedLabel = formatRelativeTime(diagnostics.generatedAt);

  return (
    <div className={styles.backdrop}>
      <div ref={containerRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id={titleId} className={styles.title}>
              Diagnostics
            </h2>
            <p className={styles.subtitle}>
              {summary ?? "No problems found"} &middot; last checked {generatedLabel}
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button variant="secondary" size="sm" onClick={recheck.run} disabled={recheck.status === "pending"}>
              Recheck files
            </Button>
            <IconButton label="Close diagnostics" icon={<X size={16} />} size="sm" onClick={onClose} />
          </div>
        </header>
        {recheck.status === "error" && recheck.message !== null ? (
          <p className={styles.actionError} role="alert">
            {recheck.message}
          </p>
        ) : null}
        <div className={styles.body}>
          {groups.length === 0 ? (
            <div className={styles.empty}>
              <CheckCircle size={22} aria-hidden="true" />
              <p className={styles.emptyTitle}>No problems found.</p>
              <p className={styles.emptyMeta}>Last checked {generatedLabel}.</p>
            </div>
          ) : (
            groups.map((group) => <DiagnosticsFileGroup key={group.file} group={group} />)
          )}
        </div>
      </div>
    </div>
  );
}
