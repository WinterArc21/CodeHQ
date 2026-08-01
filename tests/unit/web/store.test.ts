import { beforeEach, describe, expect, it } from "vitest";
import { resetCodeHQStore, useCodeHQStore } from "@web/store/useCodeHQStore";

const STORAGE_KEY = "codehq.ui";

beforeEach(() => {
  window.localStorage.clear();
  resetCodeHQStore();
});

describe("useCodeHQStore", () => {
  it("selecting a workflow clears step selection and expansion", () => {
    useCodeHQStore.getState().selectStep("step-1");
    useCodeHQStore.getState().toggleStepExpanded("step-1");
    expect(useCodeHQStore.getState().selectedStepId).toBe("step-1");
    expect(useCodeHQStore.getState().expandedStepIds).toEqual({ "step-1": true });

    useCodeHQStore.getState().selectWorkflow("workflow-a");

    expect(useCodeHQStore.getState().selectedWorkflowId).toBe("workflow-a");
    expect(useCodeHQStore.getState().selectedStepId).toBeNull();
    expect(useCodeHQStore.getState().expandedStepIds).toEqual({});
  });

  it("toggleStepExpanded toggles a single step id on and off", () => {
    useCodeHQStore.getState().toggleStepExpanded("a");
    expect(useCodeHQStore.getState().expandedStepIds).toEqual({ a: true });

    useCodeHQStore.getState().toggleStepExpanded("a");
    expect(useCodeHQStore.getState().expandedStepIds).toEqual({});
  });

  it("collapseAllSteps clears every expanded step", () => {
    useCodeHQStore.getState().toggleStepExpanded("a");
    useCodeHQStore.getState().toggleStepExpanded("b");
    useCodeHQStore.getState().collapseAllSteps();
    expect(useCodeHQStore.getState().expandedStepIds).toEqual({});
  });

  it("persists only theme and depth, under one namespaced localStorage key", () => {
    useCodeHQStore.getState().setTheme("light");
    useCodeHQStore.getState().setDepth("modules");
    useCodeHQStore.getState().selectWorkflow("some-workflow");

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
      expect(() => useCodeHQStore.getState().setTheme("dark")).not.toThrow();
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
      expect(() => useCodeHQStore.getState().setDepth("modules")).not.toThrow();
    } finally {
      window.localStorage.getItem = originalGetItem;
    }
  });
});
