import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Workflow } from "@schema/workflow";
import type { HQSnapshot, WorkflowRecord } from "@web/api/types";
import { CommandPalette } from "@web/components/search/CommandPalette";
import { resetHQStore, useHQStore } from "@web/store/useHQStore";

function makeRecord(workflow: Workflow): WorkflowRecord {
  return {
    id: workflow.id,
    file: `.hq/workflows/${workflow.id}.json`,
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

const SNAPSHOT: HQSnapshot = {
  generatedAt: new Date().toISOString(),
  status: "ready",
  repository: { name: "demo", root: "/demo", hqDir: "/demo/.hq" },
  project: null,
  workflows: [makeRecord(WORKFLOW_A), makeRecord(WORKFLOW_B)],
  diagnostics: { generatedAt: new Date().toISOString(), valid: true, issues: [] },
};

describe("CommandPalette", () => {
  beforeEach(() => {
    resetHQStore();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network calls are not expected in this test")));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    resetHQStore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is closed by default and opens on Ctrl+K", () => {
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByRole("dialog", { name: "Search HQ" })).toBeInTheDocument();
  });

  it("opens on Cmd+K (metaKey) too", () => {
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows every workflow plus the default actions on an empty query", () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    expect(screen.getByText("Site Flow")).toBeInTheDocument();
    expect(screen.getByText("Checkout")).toBeInTheDocument();
    expect(screen.getByText("Copy agent prompt")).toBeInTheDocument();
    expect(screen.getByText("Recheck files")).toBeInTheDocument();
  });

  it("filters as the user types", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "Scrape");

    expect(screen.getByText("Scrape Website")).toBeInTheDocument();
    expect(screen.queryByText("Checkout")).not.toBeInTheDocument();
    expect(screen.queryByText("Capture Payment")).not.toBeInTheDocument();
  });

  it("shows an honest empty message when nothing matches", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "xyzzy-not-present");

    expect(screen.getByRole("status")).toHaveTextContent("No results for “xyzzy-not-present”.");
  });

  it("moves the active option with Arrow keys and selects the second workflow with Enter", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const combobox = screen.getByRole("combobox");
    const user = userEvent.setup();
    await user.type(combobox, "{ArrowDown}{Enter}");

    expect(useHQStore.getState().selectedWorkflowId).toBe("checkout");
    expect(useHQStore.getState().selectedStepId).toBeNull();
    expect(useHQStore.getState().searchOpen).toBe(false);
  });

  it("selecting a step result focuses both the workflow and the step, and opens the drawer", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "Scrape");
    await user.click(screen.getByRole("option", { name: /Scrape Website/ }));

    expect(useHQStore.getState().selectedWorkflowId).toBe("site-flow");
    expect(useHQStore.getState().selectedStepId).toBe("scrape");
    expect(useHQStore.getState().searchOpen).toBe(false);
  });

  it("closes on Escape", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes on Escape when opened via the store after the initial (closed) mount", async () => {
    // Regression test: CommandPalette is always mounted so Ctrl/Cmd+K keeps working, and used to
    // wire its focus trap's effect to a dependency array that never changed identity, so the trap
    // (and its Escape handler) only ever attached if the palette happened to already be open at
    // first mount. Rendering closed, then opening afterwards, reproduces the real bug.
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    useHQStore.getState().openSearch();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes when a click starts and ends on the backdrop", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement as HTMLElement;
    expect(backdrop).not.toBe(dialog);

    fireEvent.pointerDown(backdrop);
    fireEvent.pointerUp(backdrop);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not close when a click lands inside the dialog", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(dialog);
    fireEvent.pointerUp(dialog);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not close on a pointer-down inside the dialog that drags out and releases on the backdrop", async () => {
    useHQStore.getState().openSearch();
    render(<CommandPalette snapshot={SNAPSHOT} onRecheck={() => Promise.resolve()} />);

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement as HTMLElement;

    // Simulates selecting text in the input, then dragging the mouse out and releasing on the
    // backdrop — a real, common gesture that must not be misread as "clicked outside."
    fireEvent.pointerDown(dialog);
    fireEvent.pointerUp(backdrop);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
