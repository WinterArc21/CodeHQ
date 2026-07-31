import { beforeEach, describe, expect, it } from "vitest";
import { resetObservatoryStore, useObservatoryStore } from "@web/store/useObservatoryStore";

const STORAGE_KEY = "code-observatory.ui";

beforeEach(() => {
  window.localStorage.clear();
  resetObservatoryStore();
});

describe("useObservatoryStore", () => {
  it("selecting a workflow clears step selection and expansion", () => {
    useObservatoryStore.getState().selectStep("step-1");
    useObservatoryStore.getState().toggleStepExpanded("step-1");
    expect(useObservatoryStore.getState().selectedStepId).toBe("step-1");
    expect(useObservatoryStore.getState().expandedStepIds).toEqual({ "step-1": true });

    useObservatoryStore.getState().selectWorkflow("workflow-a");

    expect(useObservatoryStore.getState().selectedWorkflowId).toBe("workflow-a");
    expect(useObservatoryStore.getState().selectedStepId).toBeNull();
    expect(useObservatoryStore.getState().expandedStepIds).toEqual({});
  });

  it("toggleStepExpanded toggles a single step id on and off", () => {
    useObservatoryStore.getState().toggleStepExpanded("a");
    expect(useObservatoryStore.getState().expandedStepIds).toEqual({ a: true });

    useObservatoryStore.getState().toggleStepExpanded("a");
    expect(useObservatoryStore.getState().expandedStepIds).toEqual({});
  });

  it("collapseAllSteps clears every expanded step", () => {
    useObservatoryStore.getState().toggleStepExpanded("a");
    useObservatoryStore.getState().toggleStepExpanded("b");
    useObservatoryStore.getState().collapseAllSteps();
    expect(useObservatoryStore.getState().expandedStepIds).toEqual({});
  });

  it("persists only theme and depth, under one namespaced localStorage key", () => {
    useObservatoryStore.getState().setTheme("light");
    useObservatoryStore.getState().setDepth("modules");
    useObservatoryStore.getState().selectWorkflow("some-workflow");

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed: { state: Record<string, unknown> } = JSON.parse(raw as string);

    expect(parsed.state.theme).toBe("light");
    expect(parsed.state.depth).toBe("modules");
    expect(Object.keys(parsed.state).sort()).toEqual(["depth", "theme"]);
  });

  it("does not throw when localStorage.setItem fails (quota exceeded, private mode, etc.)", () => {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      expect(() => useObservatoryStore.getState().setTheme("dark")).not.toThrow();
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });

  it("does not throw when localStorage.getItem fails", () => {
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
    window.localStorage.getItem = () => {
      throw new Error("SecurityError");
    };
    try {
      expect(() => useObservatoryStore.getState().setDepth("modules")).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
    }
  });
});
