/**
 * The wire model (contract §7): what the store computes and the server serves as JSON.
 * Node-only by location (lives in `src/core`), but the type shapes themselves are plain
 * data and safe to `import type` from anywhere, including the web app.
 */

import type { DiagnosticsReport } from "@schema/diagnostics";
import type { CodeHQProject } from "@schema/project";
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "./source-check";

export type CodeHQStatus = "uninitialized" | "empty" | "ready";

export interface WorkflowRecord {
  id: string;
  file: string;
  workflow: Workflow;
  modifiedAt: string;
  state: "valid" | "stale";
  staleSince?: string;
  /** key = `${file}` or `${file}#${symbol}` */
  sourceChecks: Record<string, SourceStatus>;
}

export interface RepositoryInfo {
  name: string;
  root: string;
  codeHQDir: string;
}

export interface CodeHQSnapshot {
  generatedAt: string;
  status: CodeHQStatus;
  repository: RepositoryInfo;
  project: CodeHQProject | null;
  workflows: WorkflowRecord[];
  diagnostics: DiagnosticsReport;
}
