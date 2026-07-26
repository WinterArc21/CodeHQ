import { WarningCircle, X } from "@phosphor-icons/react";
import { useState } from "react";
import type { DiagnosticsReport } from "@schema/diagnostics";
import { Button, IconButton } from "../primitives";
import styles from "./DiagnosticsBanner.module.css";

export interface DiagnosticsBannerProps {
  diagnostics: DiagnosticsReport;
  onOpenDiagnostics: () => void;
}

/**
 * The "Workflow update needs attention" strip. Dismissible, but reappears whenever a new
 * diagnostics run (a new `generatedAt`) still has errors — dismissal is remembered per report,
 * not forever.
 */
export function DiagnosticsBanner({ diagnostics, onOpenDiagnostics }: DiagnosticsBannerProps) {
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const errors = diagnostics.issues.filter((issue) => issue.severity === "error");

  if (errors.length === 0 || dismissedAt === diagnostics.generatedAt) {
    return null;
  }

  const first = errors[0];

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.text}>
        <WarningCircle size={16} aria-hidden="true" />
        <span>
          <strong>Workflow update needs attention</strong> — {errors.length} {errors.length === 1 ? "error" : "errors"}
          {first !== undefined ? `. ${first.message}` : "."} The last valid version is still being displayed.
        </span>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={onOpenDiagnostics}>
          Open diagnostics
        </Button>
        <IconButton label="Dismiss" icon={<X size={14} />} size="sm" onClick={() => setDismissedAt(diagnostics.generatedAt)} />
      </div>
    </div>
  );
}
