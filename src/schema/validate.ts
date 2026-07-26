import type { ZodError } from "zod";
import type { Issue } from "./diagnostics";
import { observatoryProjectSchema, type ObservatoryProject } from "./project";
import { formatIssuePath, validateWorkflowSemantics, VISUAL_KEYS, VISUAL_PROPERTY_MESSAGE } from "./semantics";
import { workflowSchema, type Workflow } from "./workflow";

type ZodIssue = ZodError["issues"][number];

function ensureSentence(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function hintForZodIssue(issue: ZodIssue): string | undefined {
  switch (issue.code) {
    case "invalid_type":
      return "Check that this field is present and has the correct type.";
    case "invalid_value":
      return "Use one of the allowed values.";
    case "too_small":
      return "Provide more items, or a longer value.";
    case "too_big":
      return "Provide fewer items, or a shorter value.";
    case "invalid_format":
      return "Check that the value matches the expected format.";
    default:
      return undefined;
  }
}

/**
 * Converts a ZodError into the contract's `Issue[]` shape: a readable dotted/bracketed
 * `path` (e.g. `connections[3].to`, never Zod's raw path array), and a complete-sentence
 * `message`. Unknown keys that are banned visual/layout properties get the exact
 * contract-mandated message instead of a generic "unrecognized key" message.
 */
export function zodErrorToIssues(error: ZodError, file: string): Issue[] {
  const issues: Issue[] = [];

  for (const zodIssue of error.issues) {
    const basePath = formatIssuePath(zodIssue.path);

    if (zodIssue.code === "unrecognized_keys") {
      for (const key of zodIssue.keys) {
        const keyPath = basePath.length > 0 ? `${basePath}.${key}` : key;
        if (VISUAL_KEYS.has(key)) {
          issues.push({
            severity: "error",
            file,
            path: keyPath,
            message: VISUAL_PROPERTY_MESSAGE,
            hint: "Remove this property. Code Observatory computes layout, color, and styling automatically.",
          });
        } else {
          issues.push({
            severity: "error",
            file,
            path: keyPath,
            message: `Unrecognized property '${key}' is not part of the schema.`,
            hint: "Remove it, or check for a typo against the documented fields.",
          });
        }
      }
      continue;
    }

    const hint = hintForZodIssue(zodIssue);
    issues.push({
      severity: "error",
      file,
      ...(basePath.length > 0 ? { path: basePath } : {}),
      message: ensureSentence(zodIssue.message),
      ...(hint !== undefined ? { hint } : {}),
    });
  }

  return issues;
}

export type ParseProjectResult =
  | { ok: true; value: ObservatoryProject }
  | { ok: false; issues: Issue[] };

/** Parses and shape-validates an `.observatory/project.json` payload. */
export function parseProject(data: unknown, file: string): ParseProjectResult {
  const result = observatoryProjectSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, issues: zodErrorToIssues(result.error, file) };
  }
  return { ok: true, value: result.data };
}

export type ParseWorkflowResult =
  | { ok: true; value: Workflow; warnings: Issue[] }
  | { ok: false; issues: Issue[] };

/**
 * Parses, shape-validates, and semantically validates an `.observatory/workflows/<id>.json`
 * payload. Shape errors (from Zod) short-circuit before semantic rules run. When shape
 * validation passes but a semantic rule reports an `error`, the whole workflow is invalid
 * (`ok: false`) and `issues` contains every semantic finding, errors and warnings alike, so
 * diagnostics can show the complete picture at once.
 */
export function parseWorkflow(data: unknown, file: string): ParseWorkflowResult {
  const shapeResult = workflowSchema.safeParse(data);
  if (!shapeResult.success) {
    return { ok: false, issues: zodErrorToIssues(shapeResult.error, file) };
  }

  const semanticIssues = validateWorkflowSemantics(shapeResult.data, file);
  const hasErrors = semanticIssues.some((issue) => issue.severity === "error");
  if (hasErrors) {
    return { ok: false, issues: semanticIssues };
  }

  return { ok: true, value: shapeResult.data, warnings: semanticIssues };
}
