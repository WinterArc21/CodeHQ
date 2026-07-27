import type { SourceReference } from "@schema/workflow";

/**
 * Matches `computeWorkflowSourceChecks`' key format exactly (`src/core/source-check.ts`):
 * `${file}#${symbol}` when a symbol is present, otherwise just `${file}` (contract §7).
 */
export function sourceCheckKey(ref: Pick<SourceReference, "file" | "symbol">): string {
  return ref.symbol !== undefined ? `${ref.file}#${ref.symbol}` : ref.file;
}

/** A short human line-range string, e.g. "L12" or "L12–40"; `null` when neither is present. */
export function formatLineRange(ref: Pick<SourceReference, "line" | "endLine">): string | null {
  if (ref.line === undefined) {
    return null;
  }
  if (ref.endLine === undefined || ref.endLine === ref.line) {
    return `L${ref.line}`;
  }
  return `L${ref.line}–${ref.endLine}`;
}
