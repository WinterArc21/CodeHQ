/**
 * The shape of the sanitized payload embedded in an exported HTML snapshot. This mirrors
 * `src/server/export.ts`'s `ExportPayload` — both sides define it independently because the
 * server (Node) and the export viewer (browser IIFE) live in separate tsconfig projects with
 * no shared alias between them. The shapes must stay in sync.
 */
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "../api/types";

export interface ExportPayload {
  workflow: Workflow;
  sourceChecks: Record<string, SourceStatus>;
  hideFilePaths: boolean;
  workflowName: string;
  workflowId: string;
  /** ISO timestamp of when the export was generated. */
  exportedAt: string;
  /** Repository display name only — never the root path or hq directory. */
  repositoryName: string;
}
