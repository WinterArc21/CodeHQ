import { createContext, useContext, type ReactNode } from "react";

/**
 * Provided only by the export viewer. When `null` (the normal running app), components
 * behave exactly as before — no server-only action is hidden, no path is ever masked.
 * When non-null, the component is rendering inside a self-contained exported HTML snapshot:
 * server-only actions (e.g. "Open in editor") are omitted, and `hideFilePaths` controls
 * whether repository-relative file paths are shown or masked.
 */
export interface ExportModeValue {
  hideFilePaths: boolean;
}

export const ExportModeContext = createContext<ExportModeValue | null>(null);

/** Returns the export-mode context value, or `null` when running in the normal app. */
export function useExportMode(): ExportModeValue | null {
  return useContext(ExportModeContext);
}

/** Convenience: wraps children in the export-mode provider. */
export function ExportModeProvider({ value, children }: { value: ExportModeValue; children: ReactNode }) {
  return <ExportModeContext.Provider value={value}>{children}</ExportModeContext.Provider>;
}
