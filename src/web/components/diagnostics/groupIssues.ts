import type { Issue } from "@schema/diagnostics";

export interface DiagnosticsFileGroup {
  file: string;
  issues: Issue[];
  errorCount: number;
  warningCount: number;
}

const SEVERITY_RANK: Record<Issue["severity"], number> = { error: 0, warning: 1 };

/**
 * Groups issues by `file`; within a group, errors sort before warnings (a stable sort, so
 * issues of the same severity keep their original relative order). Groups are then ordered so
 * files with at least one error come first — the ones a human, or a repairing agent, most needs
 * to act on — with ties broken alphabetically by file path for a deterministic result.
 */
export function groupIssuesByFile(issues: Issue[]): DiagnosticsFileGroup[] {
  const filesInOrder: string[] = [];
  const issuesByFile = new Map<string, Issue[]>();

  for (const issue of issues) {
    const existing = issuesByFile.get(issue.file);
    if (existing === undefined) {
      issuesByFile.set(issue.file, [issue]);
      filesInOrder.push(issue.file);
    } else {
      existing.push(issue);
    }
  }

  const groups = filesInOrder.map((file): DiagnosticsFileGroup => {
    const fileIssues = issuesByFile.get(file) ?? [];
    return {
      file,
      issues: [...fileIssues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
      errorCount: fileIssues.filter((issue) => issue.severity === "error").length,
      warningCount: fileIssues.filter((issue) => issue.severity === "warning").length,
    };
  });

  return groups.sort((a, b) => {
    const aRank = a.errorCount > 0 ? 0 : 1;
    const bRank = b.errorCount > 0 ? 0 : 1;
    return aRank !== bRank ? aRank - bRank : a.file.localeCompare(b.file);
  });
}

/** A short "N errors, M warnings" summary line, or `null` when there are no issues at all. */
export function summarizeIssues(issues: Issue[]): string | null {
  if (issues.length === 0) {
    return null;
  }
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const parts: string[] = [];
  if (errorCount > 0) {
    parts.push(`${errorCount} ${errorCount === 1 ? "error" : "errors"}`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`);
  }
  return parts.join(", ");
}
