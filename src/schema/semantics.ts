import type { Issue } from "./diagnostics";
import { describePathProblem } from "./paths";
import type { SourceReference, Workflow } from "./workflow";

/**
 * Pure, isomorphic semantic validation for an already shape-valid `Workflow`.
 * Every function here returns `Issue[]` and never throws — see contract §5.
 */

const WORKFLOW_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const MAX_RECOMMENDED_STEPS = 14;

/** Visual/layout keys banned anywhere in workflow files — HQ owns rendering. */
export const VISUAL_KEYS = new Set([
  "x",
  "y",
  "position",
  "color",
  "colour",
  "style",
  "width",
  "height",
  "font",
  "css",
  "layout",
  "icon",
]);

export const VISUAL_PROPERTY_MESSAGE =
  "Visual properties are owned by HQ and must not appear in workflow files.";

/**
 * Formats a Zod-style path array as `connections[3].to`, not Zod's raw array form.
 * Zod types path segments as `PropertyKey` (JSON paths never actually contain symbols);
 * any symbol is stringified defensively so this never throws.
 */
export function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  let result = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      const key = String(segment);
      result += result.length > 0 ? `.${key}` : key;
    }
  }
  return result;
}

/**
 * Recursively scans raw, untrusted data for banned visual/layout keys at any depth and
 * reports them with the exact contract-mandated message. Safe to call on raw JSON before
 * (or instead of) shape validation, and on an already-parsed `Workflow` for defense in depth.
 */
export function findVisualPropertyIssues(value: unknown, file: string, path = ""): Issue[] {
  const issues: Issue[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      issues.push(...findVisualPropertyIssues(item, file, `${path}[${index}]`));
    });
    return issues;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const keyPath = path.length > 0 ? `${path}.${key}` : key;
      if (VISUAL_KEYS.has(key)) {
        issues.push({
          severity: "error",
          file,
          path: keyPath,
          message: VISUAL_PROPERTY_MESSAGE,
          hint: "Remove this property. HQ computes layout, color, and styling automatically.",
        });
        continue;
      }
      issues.push(...findVisualPropertyIssues(nestedValue, file, keyPath));
    }
  }
  return issues;
}

/** Rule 1 — step ids unique within a workflow. */
function checkUniqueStepIds(workflow: Workflow, file: string): Issue[] {
  const issues: Issue[] = [];
  const firstIndexById = new Map<string, number>();
  workflow.steps.forEach((step, index) => {
    const firstIndex = firstIndexById.get(step.id);
    if (firstIndex === undefined) {
      firstIndexById.set(step.id, index);
      return;
    }
    issues.push({
      severity: "error",
      file,
      path: `steps[${index}].id`,
      message: `Duplicate step id '${step.id}'. Step ids must be unique within a workflow.`,
      hint: `Rename this step to a unique id, or remove the duplicate of 'steps[${firstIndex}]'.`,
    });
  });
  return issues;
}

/** Rule 2 — every connection.from / connection.to references an existing step id. */
function checkConnectionReferences(workflow: Workflow, file: string): Issue[] {
  const stepIds = new Set(workflow.steps.map((step) => step.id));
  const issues: Issue[] = [];
  workflow.connections.forEach((connection, index) => {
    (["from", "to"] as const).forEach((key) => {
      const referencedId = connection[key];
      if (!stepIds.has(referencedId)) {
        issues.push({
          severity: "error",
          file,
          path: `connections[${index}].${key}`,
          message: `Connection references missing step '${referencedId}'.`,
          hint: `Add a step with id '${referencedId}', or point this connection at an existing step.`,
        });
      }
    });
  });
  return issues;
}

/** Rule 3 — steps.length >= 1. */
function checkHasSteps(workflow: Workflow, file: string): Issue[] {
  if (workflow.steps.length > 0) {
    return [];
  }
  return [
    {
      severity: "error",
      file,
      path: "steps",
      message: "Workflow has no steps.",
      hint: "Add at least one step describing what this workflow does.",
    },
  ];
}

/** Rule 4 — every SourceReference.file / TestReference.file is repository-relative. */
function checkFilePaths(workflow: Workflow, file: string): Issue[] {
  const issues: Issue[] = [];
  const checkPath = (issuePath: string, value: string): void => {
    const problem = describePathProblem(value);
    if (problem) {
      issues.push({
        severity: "error",
        file,
        path: issuePath,
        message: `Invalid path '${value}': ${problem}`,
        hint: 'Use a path relative to the repository root, e.g. "src/server/orders.ts".',
      });
    }
  };

  if (workflow.entryPoint !== undefined) {
    checkPath("entryPoint.file", workflow.entryPoint.file);
  }

  workflow.steps.forEach((step, stepIndex) => {
    (step.sources ?? []).forEach((ref, refIndex) => {
      checkPath(`steps[${stepIndex}].sources[${refIndex}].file`, ref.file);
    });
    (step.tests ?? []).forEach((ref, refIndex) => {
      checkPath(`steps[${stepIndex}].tests[${refIndex}].file`, ref.file);
    });
    (step.edgeCases ?? []).forEach((edgeCase, edgeCaseIndex) => {
      (edgeCase.sources ?? []).forEach((ref, refIndex) => {
        checkPath(`steps[${stepIndex}].edgeCases[${edgeCaseIndex}].sources[${refIndex}].file`, ref.file);
      });
    });
  });
  return issues;
}

/** Rule 5 — line <= endLine when both are present on a SourceReference. */
function checkLineRanges(workflow: Workflow, file: string): Issue[] {
  const issues: Issue[] = [];
  const checkRange = (issuePath: string, ref: SourceReference): void => {
    if (ref.line !== undefined && ref.endLine !== undefined && ref.line > ref.endLine) {
      issues.push({
        severity: "error",
        file,
        path: `${issuePath}.line`,
        message: `SourceReference.line (${ref.line}) must not be greater than endLine (${ref.endLine}).`,
        hint: "Swap line and endLine, or correct the range.",
      });
    }
  };

  if (workflow.entryPoint !== undefined) {
    checkRange("entryPoint", workflow.entryPoint);
  }

  workflow.steps.forEach((step, stepIndex) => {
    (step.sources ?? []).forEach((ref, refIndex) => {
      checkRange(`steps[${stepIndex}].sources[${refIndex}]`, ref);
    });
    (step.edgeCases ?? []).forEach((edgeCase, edgeCaseIndex) => {
      (edgeCase.sources ?? []).forEach((ref, refIndex) => {
        checkRange(`steps[${stepIndex}].edgeCases[${edgeCaseIndex}].sources[${refIndex}]`, ref);
      });
    });
  });
  return issues;
}

/** Rule 6 — workflow id matches ^[a-z0-9][a-z0-9-]*$. */
function checkWorkflowIdPattern(workflow: Workflow, file: string): Issue[] {
  if (WORKFLOW_ID_PATTERN.test(workflow.id)) {
    return [];
  }
  return [
    {
      severity: "error",
      file,
      path: "id",
      message: `Workflow.id '${workflow.id}' must match ^[a-z0-9][a-z0-9-]*$.`,
      hint: "Use lowercase letters, digits, and hyphens only, starting with a letter or digit.",
    },
  ];
}

function computeEntryStepIds(workflow: Workflow): Set<string> {
  const categorizedEntries = workflow.steps.filter((step) => step.category === "entry").map((step) => step.id);
  if (categorizedEntries.length > 0) {
    return new Set(categorizedEntries);
  }

  const stepsWithIncoming = new Set(workflow.connections.map((connection) => connection.to));
  const zeroIndegreeSteps = workflow.steps.filter((step) => !stepsWithIncoming.has(step.id)).map((step) => step.id);
  if (zeroIndegreeSteps.length > 0) {
    return new Set(zeroIndegreeSteps);
  }

  const firstStep = workflow.steps[0];
  return firstStep ? new Set([firstStep.id]) : new Set();
}

/**
 * Rule 7 — warn (not error) on a step unreachable from any entry step, and on a workflow
 * with more than 14 steps. "Entry" steps are those categorized `entry`; if none are
 * categorized, steps with no incoming connection are treated as entries instead.
 */
function checkReachabilityAndSize(workflow: Workflow, file: string): Issue[] {
  const issues: Issue[] = [];
  const entryStepIds = computeEntryStepIds(workflow);

  const adjacency = new Map<string, string[]>();
  for (const connection of workflow.connections) {
    const targets = adjacency.get(connection.from) ?? [];
    targets.push(connection.to);
    adjacency.set(connection.from, targets);
  }

  const reached = new Set<string>();
  const queue: string[] = [...entryStepIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || reached.has(current)) {
      continue;
    }
    reached.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!reached.has(next)) {
        queue.push(next);
      }
    }
  }

  workflow.steps.forEach((step, index) => {
    if (!reached.has(step.id)) {
      issues.push({
        severity: "warning",
        file,
        path: `steps[${index}].id`,
        message: `Step '${step.id}' is unreachable from any entry step.`,
        hint: "Connect this step from an entry step, mark it category \"entry\", or remove it if it is unused.",
      });
    }
  });

  if (workflow.steps.length > MAX_RECOMMENDED_STEPS) {
    issues.push({
      severity: "warning",
      file,
      path: "steps",
      message: `Workflow has ${workflow.steps.length} steps, which is more than the recommended maximum of ${MAX_RECOMMENDED_STEPS}.`,
      hint: "Prefer 5-9 top-level steps; group related steps or split this into multiple workflows.",
    });
  }

  return issues;
}

/** Rule 8 — warn (not error) on a duplicate connection (same from/to/type). */
function checkDuplicateConnections(workflow: Workflow, file: string): Issue[] {
  const issues: Issue[] = [];
  const firstIndexByKey = new Map<string, number>();
  workflow.connections.forEach((connection, index) => {
    const key = `${connection.from}=>${connection.to}#${connection.type ?? "success"}`;
    const firstIndex = firstIndexByKey.get(key);
    if (firstIndex === undefined) {
      firstIndexByKey.set(key, index);
      return;
    }
    issues.push({
      severity: "warning",
      file,
      path: `connections[${index}]`,
      message: `Duplicate connection from '${connection.from}' to '${connection.to}' (type: ${connection.type ?? "success"}).`,
      hint: "Remove this duplicate, or differentiate it with a distinct 'condition' or 'type'.",
    });
  });
  return issues;
}

/** Runs all 8 semantic rules from contract §5, plus the visual-key rejection, over `workflow`. */
export function validateWorkflowSemantics(workflow: Workflow, file: string): Issue[] {
  return [
    ...checkUniqueStepIds(workflow, file),
    ...checkConnectionReferences(workflow, file),
    ...checkHasSteps(workflow, file),
    ...checkFilePaths(workflow, file),
    ...checkLineRanges(workflow, file),
    ...checkWorkflowIdPattern(workflow, file),
    ...checkReachabilityAndSize(workflow, file),
    ...checkDuplicateConnections(workflow, file),
    ...findVisualPropertyIssues(workflow, file),
  ];
}
