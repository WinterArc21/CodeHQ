/**
 * The server -> web wire model, contract §7. `Workflow`, `CodeHQProject`, and
 * `DiagnosticsReport` are the real, validated schema types — never re-declared here.
 */
import type { DiagnosticsReport } from "@schema/diagnostics";
import type { CodeHQProject } from "@schema/project";
import type { Workflow } from "@schema/workflow";

/** How a `SourceReference`/`TestReference` target currently resolves on disk. */
export type SourceStatus = "verified" | "file-only" | "missing";

export interface WorkflowRecord {
  id: string;
  /** Repository-relative path, e.g. `.codehq/workflows/checkout.json`. */
  file: string;
  /** The last VALID version of this workflow (contract §7.1 — never blanks out). */
  workflow: Workflow;
  /** ISO timestamp. */
  modifiedAt: string;
  /** `"stale"` means a newer INVALID version exists on disk. */
  state: "valid" | "stale";
  /** ISO timestamp; present only when `state === "stale"`. */
  staleSince?: string;
  /** Keyed by `${file}` or `${file}#${symbol}`. */
  sourceChecks: Record<string, SourceStatus>;
}
export interface CodeHQSnapshot {
  generatedAt: string;
  status: "uninitialized" | "empty" | "ready";
  repository: { name: string; root: string; codeHQDir: string };
  project: CodeHQProject | null;
  workflows: WorkflowRecord[];
  diagnostics: DiagnosticsReport;
}

/** `GET /api/source` response shape (metadata only — never file contents, contract §8). */
export interface SourceLookup {
  file: string;
  absolutePath: string;
  exists: boolean;
  editorUrl?: string;
  lines?: string[];
}
