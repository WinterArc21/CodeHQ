import { beforeEach, describe, expect, it } from "vitest";
import { resetHQStore, useHQStore } from "@web/store/useHQStore";

const STORAGE_KEY = "hq.ui";

beforeEach(() => {
  window.localStorage.clear();
  resetHQStore();
});

describe("useHQStore", () => {
  it("selecting a workflow clears step selection and expansion", () => {
    useHQStore.getState().selectStep("step-1");
    useHQStore.getState().toggleStepExpanded("step-1");
    expect(useHQStore.getState().selectedStepId).toBe("step-1");
    expect(useHQStore.getState().expandedStepIds).toEqual({ "step-1": true });

    useHQStore.getState().selectWorkflow("workflow-a");

    expect(useHQStore.getState().selectedWorkflowId).toBe("workflow-a");
    expect(useHQStore.getState().selectedStepId).toBeNull();
    expect(useHQStore.getState().expandedStepIds).toEqual({});
  });

  it("toggleStepExpanded toggles a single step id on and off", () => {
    useHQStore.getState().toggleStepExpanded("a");
    expect(useHQStore.getState().expandedStepIds).toEqual({ a: true });

    useHQStore.getState().toggleStepExpanded("a");
    expect(useHQStore.getState().expandedStepIds).toEqual({});
  });

  it("collapseAllSteps clears every expanded step", () => {
    useHQStore.getState().toggleStepExpanded("a");
    useHQStore.getState().toggleStepExpanded("b");
    useHQStore.getState().collapseAllSteps();
    expect(useHQStore.getState().expandedStepIds).toEqual({});
  });

  it("persists only theme and depth, under one namespaced localStorage key", () => {
    useHQStore.getState().setTheme("light");
    useHQStore.getState().setDepth("modules");
    useHQStore.getState().selectWorkflow("some-workflow");

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
      expect(() => useHQStore.getState().setTheme("dark")).not.toThrow();
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
      expect(() => useHQStore.getState().setDepth("modules")).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
    }
  });
});
