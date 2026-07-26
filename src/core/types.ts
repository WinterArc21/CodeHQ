/**
 * The wire model (contract §7): what the store computes and the server serves as JSON.
 * Node-only by location (lives in `src/core`), but the type shapes themselves are plain
 * data and safe to `import type` from anywhere, including the web app.
 */

import type { DiagnosticsReport } from "@schema/diagnostics";
import type { ObservatoryProject } from "@schema/project";
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "./source-check";

export type ObservatoryStatus = "uninitialized" | "empty" | "ready";

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
  observatoryDir: string;
}

export interface ObservatorySnapshot {
  generatedAt: string;
  status: ObservatoryStatus;
  repository: RepositoryInfo;
  project: ObservatoryProject | null;
  workflows: WorkflowRecord[];
  diagnostics: DiagnosticsReport;
}
