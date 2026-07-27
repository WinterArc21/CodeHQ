import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Workflow } from "@schema/workflow";
import type { ObservatorySnapshot, WorkflowRecord } from "@web/api/types";
import { CommandPalette } from "@web/components/search/CommandPalette";
import { resetObservatoryStore, useObservatoryStore } from "@web/store/useObservatoryStore";

function makeRecord(workflow: Workflow): WorkflowRecord {
  return {
    id: workflow.id,
    file: `.observatory/workflows/${workflow.id}.json`,
    workflow,
    modifiedAt: new Date().toISOString(),
    state: "valid",
    sourceChecks: {},
  };
}

const WORKFLOW_A: Workflow = {
  schemaVersion: "0.1",
  id: "site-flow",
  name: "Site Flow",
  purpose: "Turns a website into a video prompt.",
  steps: [{ id: "scrape", name: "Scrape Website", purpose: "Fetches pages from the target site." }],
  connections: [],
};

const WORKFLOW_B: Workflow = {
  schemaVersion: "0.1",
  id: "checkout",
  name: "Checkout",
  purpose: "Captures payment for a cart.",
  steps: [{ id: "capture", name: "Capture Payment", purpose: "Charges the customer." }],
  connections: [],
};

const SNAPSHOT: ObservatorySnapshot = {
  generatedAt: new Date().toISOString(),
  status: "ready",
  repository: { name: "demo", root: "/demo", observatoryDir: "/demo/.observatory" },
  project: null,
  workflows: [makeRecord(WORKFLOW_A), makeRecord(WORKFLOW_B)],
  diagnostics: { generatedAt: new Date().toISOString(), valid: true, issues: [] },
};

describe("CommandPalette", () => {
  beforeEach(() => {
    resetObservatoryStore();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network calls are not expected in this test")));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    resetObservatoryStore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is closed by default and opens on Ctrl+K", () => {
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByRole("dialog", { name: "Search Code Observatory" })).toBeInTheDocument();
  });

  it("opens on Cmd+K (metaKey) too", () => {
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows every workflow plus the default actions on an empty query", () => {
    useObservatoryStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    expect(screen.getByText("Site Flow")).toBeInTheDocument();
    expect(screen.getByText("Checkout")).toBeInTheDocument();
    expect(screen.getByText("Copy agent prompt")).toBeInTheDocument();
    expect(screen.getByText("Reveal .observatory")).toBeInTheDocument();
    expect(screen.getByText("Recheck files")).toBeInTheDocument();
  });

  it("filters as the user types", async () => {
    useObservatoryStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "Scrape");

    expect(screen.getByText("Scrape Website")).toBeInTheDocument();
    expect(screen.queryByText("Checkout")).not.toBeInTheDocument();
    expect(screen.queryByText("Capture Payment")).not.toBeInTheDocument();
  });

  it("shows an honest empty message when nothing matches", async () => {
    useObservatoryStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "xyzzy-not-present");

    expect(screen.getByRole("status")).toHaveTextContent("No results for “xyzzy-not-present”.");
  });

  it("moves the active option with Arrow keys and selects the second workflow with Enter", async () => {
    useObservatoryStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const combobox = screen.getByRole("combobox");
    const user = userEvent.setup();
    await user.type(combobox, "{ArrowDown}{Enter}");

    expect(useObservatoryStore.getState().selectedWorkflowId).toBe("checkout");
    expect(useObservatoryStore.getState().selectedStepId).toBeNull();
    expect(useObservatoryStore.getState().searchOpen).toBe(false);
  });

  it("selecting a step result focuses both the workflow and the step, and opens the drawer", async () => {
    useObservatoryStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "Scrape");
    await user.click(screen.getByRole("option", { name: /Scrape Website/ }));

    expect(useObservatoryStore.getState().selectedWorkflowId).toBe("site-flow");
    expect(useObservatoryStore.getState().selectedStepId).toBe("scrape");
    expect(useObservatoryStore.getState().searchOpen).toBe(false);
  });

  it("closes on Escape", async () => {
    useObservatoryStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
