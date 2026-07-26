import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "@web/components/states/EmptyState";
import { UninitializedState } from "@web/components/states/UninitializedState";
import { AGENT_ONBOARDING_PROMPT } from "@web/components/shell/CopyAgentPrompt";

describe("EmptyState", () => {
  beforeEach(() => {
    // "Reveal skill file" hits the real API client internally; stub fetch defensively so a
    // stray click never attempts a real network call from the test environment.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network calls are not expected in this test")),
    );
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders all four actions", () => {
    render(<EmptyState onShowExample={() => {}} onRecheck={() => Promise.resolve()} />);

    expect(screen.getByRole("button", { name: "Copy prompt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal skill file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show example workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recheck files" })).toBeInTheDocument();
  });

  it("copies the exact onboarding prompt string", async () => {
    // fireEvent (not userEvent) here: userEvent.setup() installs its own Clipboard polyfill
    // whenever navigator.clipboard isn't already its own stub, which would shadow this mock.
    const clipboard = navigator.clipboard as unknown as { writeText: (text: string) => Promise<void> };
    render(<EmptyState onShowExample={() => {}} onRecheck={() => Promise.resolve()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith(AGENT_ONBOARDING_PROMPT));
  });

  it("calls onShowExample when 'Show example workflow' is activated", async () => {
    const onShowExample = vi.fn();
    render(<EmptyState onShowExample={onShowExample} onRecheck={() => Promise.resolve()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Show example workflow" }));

    expect(onShowExample).toHaveBeenCalledTimes(1);
  });

  it("calls onRecheck when 'Recheck files' is activated", async () => {
    const onRecheck = vi.fn().mockResolvedValue(undefined);
    render(<EmptyState onShowExample={() => {}} onRecheck={onRecheck} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Recheck files" }));

    expect(onRecheck).toHaveBeenCalledTimes(1);
  });
});

describe("UninitializedState", () => {
  it("renders the exact init command", () => {
    render(<UninitializedState />);
    expect(screen.getByText("npx code-observatory init")).toBeInTheDocument();
  });

  it("renders a copy control for the command", () => {
    render(<UninitializedState />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
