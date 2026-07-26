/**
 * Builds and atomically persists `.observatory/diagnostics.json` (contract §6).
 */

import type { DiagnosticsReport, Issue } from "@schema/diagnostics";
import { pathExists, writeFileAtomic } from "./fs-utils";
import { observatoryPaths } from "./repository";

function compareIssues(a: Issue, b: Issue): number {
  if (a.severity !== b.severity) {
    return a.severity === "error" ? -1 : 1;
  }
  if (a.file !== b.file) {
    return a.file < b.file ? -1 : 1;
  }
  const aPath = a.path ?? "";
  const bPath = b.path ?? "";
  if (aPath !== bPath) {
    return aPath < bPath ? -1 : 1;
  }
  return 0;
}

/** Sorts `issues` (errors before warnings, then by file, then by path) and computes `valid`. */
export function buildDiagnostics(issues: Issue[]): DiagnosticsReport {
  const sortedIssues = [...issues].sort(compareIssues);
  return {
    generatedAt: new Date().toISOString(),
    valid: !sortedIssues.some((issue) => issue.severity === "error"),
    issues: sortedIssues,
  };
}

/**
 * Writes `report` to `.observatory/diagnostics.json`, pretty-printed with a trailing
 * newline, atomically (write-then-rename) so a watching agent never observes a
 * half-written file. A no-op when `.observatory/` does not exist (uninitialized repo).
 */
export async function writeDiagnostics(root: string, report: DiagnosticsReport): Promise<void> {
  const paths = observatoryPaths(root);
  if (!(await pathExists(paths.dir))) {
    return;
  }
  const contents = `${JSON.stringify(report, null, 2)}\n`;
  await writeFileAtomic(paths.diagnosticsFile, contents);
}
