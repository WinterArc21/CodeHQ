/**
 * Pure, framework-free helpers describing what a `StepNode` shows at each depth level, and how
 * tall that content is. `layout.ts` uses `computeNodeHeight` to size nodes; `StepNode.tsx` uses
 * the list-building helpers to render exactly the same rows it was sized for — one source of
 * truth, so the deterministic layout in `layout.ts` can never drift from what actually renders.
 */
import type { SourceReference, WorkflowStep } from "@schema/workflow";
import type { SourceStatus } from "../../api/types";
import type { Depth } from "../../store/useObservatoryStore";

/** Fixed node width across every depth — only height grows with content (contract §10/§11). */
export const NODE_WIDTH = 300;

export const MAX_MODULE_ROWS = 5;
export const MAX_SYMBOL_ROWS = 8;

const NODE_PADDING_Y = 10;
const HEADER_ROW_HEIGHT = 22;
const PURPOSE_ROW_HEIGHT = 18;
const META_ROW_HEIGHT = 18;
const COUNTS_ROW_HEIGHT = 16;
const SECTION_LABEL_HEIGHT = 16;
const FILE_ROW_HEIGHT = 16;
// Slightly taller than a file row: a symbol row carries more content (file + arrow + symbol()),
// and keeping it taller guarantees `symbols` depth is strictly taller than `modules` depth even
// when both show the same number of rows (contract requirement: node height grows with depth).
const SYMBOL_ROW_HEIGHT = 18;
const MORE_ROW_HEIGHT = 14;
const EXPAND_ROW_HEIGHT = 24;

export interface StepCounts {
  sources: number;
  edgeCases: number;
  tests: number;
}

/** Compact counts shown on a collapsed node — each rendered only when greater than zero. */
export function stepCounts(step: WorkflowStep): StepCounts {
  return {
    sources: step.sources?.length ?? 0,
    edgeCases: step.edgeCases?.length ?? 0,
    tests: step.tests?.length ?? 0,
  };
}

/** Splits a repo-relative path into its directory prefix (kept) and basename. */
export function splitPath(file: string): { dir: string; base: string } {
  const separatorIndex = file.lastIndexOf("/");
  if (separatorIndex === -1) {
    return { dir: "", base: file };
  }
  return { dir: file.slice(0, separatorIndex + 1), base: file.slice(separatorIndex + 1) };
}

/** Distinct source files referenced by a step's `sources`, in first-seen order (depth `modules`). */
export function stepModuleFiles(step: WorkflowStep): string[] {
  const seen = new Set<string>();
  const files: string[] = [];
  for (const source of step.sources ?? []) {
    if (!seen.has(source.file)) {
      seen.add(source.file);
      files.push(source.file);
    }
  }
  return files;
}

export interface StepSymbolRow {
  file: string;
  symbol?: string;
}

/**
 * One row per distinct (file, symbol) pair referenced by a step's `sources`, in first-seen
 * order (depth `symbols`). A source with no `symbol` still produces a file-only row, so nothing
 * a step references is silently dropped when going one level deeper than `modules`.
 */
export function stepSymbolRows(step: WorkflowStep): StepSymbolRow[] {
  const seen = new Set<string>();
  const rows: StepSymbolRow[] = [];
  for (const source of step.sources ?? []) {
    const key = `${source.file}#${source.symbol ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push(source.symbol !== undefined ? { file: source.file, symbol: source.symbol } : { file: source.file });
  }
  return rows;
}

function isStepIdExpanded(expandedStepIds: ReadonlySet<string> | Record<string, true>, stepId: string): boolean {
  if (expandedStepIds instanceof Set) {
    return expandedStepIds.has(stepId);
  }
  // `instanceof Set` only narrows the concrete `Set` class, not the structural `ReadonlySet`
  // half of the union, so TS can't drop it here on its own — the two branches are exhaustive.
  return (expandedStepIds as Record<string, true>)[stepId] === true;
}

/**
 * A step's per-node expand toggle overrides the global depth for that one step only: expanding
 * always shows the deepest (`symbols`) view regardless of the global setting; collapsing falls
 * back to whatever the global depth currently is.
 */
export function effectiveDepthForStep(
  step: WorkflowStep,
  depth: Depth,
  expandedStepIds: ReadonlySet<string> | Record<string, true>,
): Depth {
  return isStepIdExpanded(expandedStepIds, step.id) ? "symbols" : depth;
}

function sourceCheckKey(ref: Pick<SourceReference, "file" | "symbol">): string {
  return ref.symbol !== undefined ? `${ref.file}#${ref.symbol}` : ref.file;
}

/**
 * Every `sourceChecks` key that could describe this step (mirrors the key derivation in
 * `src/core/source-check.ts`: `sources`, `tests`, and `edgeCases[].sources`).
 */
export function stepSourceCheckKeys(step: WorkflowStep): string[] {
  const keys: string[] = [];
  for (const source of step.sources ?? []) {
    keys.push(sourceCheckKey(source));
  }
  for (const test of step.tests ?? []) {
    keys.push(sourceCheckKey(test));
  }
  for (const edgeCase of step.edgeCases ?? []) {
    for (const source of edgeCase.sources ?? []) {
      keys.push(sourceCheckKey(source));
    }
  }
  return keys;
}

/** Whether any of this step's source/test references resolves to `"missing"` on disk. */
export function stepHasMissingSource(step: WorkflowStep, sourceChecks: Record<string, SourceStatus>): boolean {
  return stepSourceCheckKeys(step).some((key) => sourceChecks[key] === "missing");
}

/**
 * Deterministic node height for a step at a given effective depth. Purely structural — driven
 * only by which rows are present and capped list lengths, never by measuring wrapped text —
 * so it is identical in a Node test and in the browser (contract §11: "Do not measure the DOM").
 */
export function computeNodeHeight(step: WorkflowStep, effectiveDepth: Depth): number {
  let height = NODE_PADDING_Y * 2 + HEADER_ROW_HEIGHT + PURPOSE_ROW_HEIGHT + META_ROW_HEIGHT + EXPAND_ROW_HEIGHT;

  const counts = stepCounts(step);
  if (counts.sources > 0 || counts.edgeCases > 0 || counts.tests > 0) {
    height += COUNTS_ROW_HEIGHT;
  }

  if (effectiveDepth === "modules") {
    const files = stepModuleFiles(step);
    if (files.length > 0) {
      height += SECTION_LABEL_HEIGHT + Math.min(files.length, MAX_MODULE_ROWS) * FILE_ROW_HEIGHT;
      if (files.length > MAX_MODULE_ROWS) {
        height += MORE_ROW_HEIGHT;
      }
    }
  }

  if (effectiveDepth === "symbols") {
    const rows = stepSymbolRows(step);
    if (rows.length > 0) {
      height += SECTION_LABEL_HEIGHT + Math.min(rows.length, MAX_SYMBOL_ROWS) * SYMBOL_ROW_HEIGHT;
      if (rows.length > MAX_SYMBOL_ROWS) {
        height += MORE_ROW_HEIGHT;
      }
    }
  }

  return height;
}
