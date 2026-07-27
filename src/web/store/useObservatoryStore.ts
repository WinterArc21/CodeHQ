import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

/**
 * UI state only (contract §11) — workflow/step/project data always comes from the server
 * snapshot (see `api/events.ts`) and never lives here.
 */

export type Depth = "workflow" | "modules" | "symbols";
export type Theme = "dark" | "light";

interface ObservatoryUiState {
  selectedWorkflowId: string | null;
  selectedStepId: string | null;
  depth: Depth;
  /** Per-step expansion overriding the global `depth` for that one step; `true` = expanded. */
  expandedStepIds: Record<string, true>;
  searchQuery: string;
  searchOpen: boolean;
  diagnosticsOpen: boolean;
  theme: Theme;
}

interface ObservatoryUiActions {
  selectWorkflow: (workflowId: string | null) => void;
  selectStep: (stepId: string | null) => void;
  setDepth: (depth: Depth) => void;
  toggleStepExpanded: (stepId: string) => void;
  collapseAllSteps: () => void;
  setSearchQuery: (query: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleDiagnostics: () => void;
  closeDiagnostics: () => void;
  setTheme: (theme: Theme) => void;
}

export type ObservatoryStore = ObservatoryUiState & ObservatoryUiActions;

const STORAGE_KEY = "code-observatory.ui";

/**
 * Wraps `window.localStorage` so a failure (quota exceeded, private browsing, storage
 * disabled by policy) can never crash the app — persistence is a convenience, not a
 * requirement, so every failure is swallowed after being reduced to a no-op.
 */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Storage unavailable or full: this write is simply not persisted this session.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Nothing to clean up if storage never accepted writes in the first place.
    }
  },
};

const INITIAL_STATE: ObservatoryUiState = {
  selectedWorkflowId: null,
  selectedStepId: null,
  depth: "workflow",
  expandedStepIds: {},
  searchQuery: "",
  searchOpen: false,
  diagnosticsOpen: false,
  theme: "dark",
};

export const useObservatoryStore = create<ObservatoryStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      selectWorkflow: (workflowId) =>
        set({ selectedWorkflowId: workflowId, selectedStepId: null, expandedStepIds: {} }),

      // The diagnostics panel and the step drawer are both single-focus overlays (contract §11
      // accessibility: focus traps must never nest) — selecting a step always closes
      // diagnostics, and opening diagnostics always clears the selected step, so exactly one of
      // the two can be on screen at a time.
      selectStep: (stepId) =>
        set((state) => ({
          selectedStepId: stepId,
          diagnosticsOpen: stepId !== null ? false : state.diagnosticsOpen,
        })),

      setDepth: (depth) => set({ depth }),

      toggleStepExpanded: (stepId) =>
        set((state) => {
          const next = { ...state.expandedStepIds };
          if (next[stepId]) {
            delete next[stepId];
          } else {
            next[stepId] = true;
          }
          return { expandedStepIds: next };
        }),

      collapseAllSteps: () => set({ expandedStepIds: {} }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      openSearch: () => set({ searchOpen: true }),

      closeSearch: () => set({ searchOpen: false }),

      toggleDiagnostics: () =>
        set((state) => {
          const diagnosticsOpen = !state.diagnosticsOpen;
          return { diagnosticsOpen, selectedStepId: diagnosticsOpen ? null : state.selectedStepId };
        }),

      closeDiagnostics: () => set({ diagnosticsOpen: false }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ theme: state.theme, depth: state.depth }),
    },
  ),
);

/** Test-only helper (and handy for "reset" affordances) to restore the initial UI state. */
export function resetObservatoryStore(): void {
  useObservatoryStore.setState({ ...INITIAL_STATE });
}
