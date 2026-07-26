import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkflowNavigator } from "@web/components/navigator/WorkflowNavigator";
import type { WorkflowRecord } from "@web/api/types";

function makeRecord(id: string, name: string): WorkflowRecord {
  return {
    id,
    file: `.observatory/workflows/${id}.json`,
    workflow: {
      schemaVersion: "0.1",
      id,
      name,
      purpose: `Purpose for ${name}.`,
      steps: [{ id: "step-1", name: "Step 1", purpose: "Does something." }],
      connections: [],
    },
    modifiedAt: new Date().toISOString(),
    state: "valid",
    sourceChecks: {},
  };
}

describe("WorkflowNavigator", () => {
  const records = [makeRecord("alpha", "Alpha"), makeRecord("beta", "Beta"), makeRecord("gamma", "Gamma")];

  it("renders every workflow's name", () => {
    render(<WorkflowNavigator workflows={records} selectedWorkflowId={null} onSelect={() => {}} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("selects a workflow via a mouse click", async () => {
    const onSelect = vi.fn();
    render(<WorkflowNavigator workflows={records} selectedWorkflowId={null} onSelect={onSelect} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Beta/ }));

    expect(onSelect).toHaveBeenCalledWith("beta");
  });

  it("selects a workflow via the keyboard (Tab, Arrow Down, Enter)", async () => {
    const onSelect = vi.fn();
    render(<WorkflowNavigator workflows={records} selectedWorkflowId={null} onSelect={onSelect} />);

    const user = userEvent.setup();
    await user.tab(); // focuses the first workflow button (Alpha)
    await user.keyboard("{ArrowDown}"); // moves focus to the second (Beta)
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("beta");
  });

  it("exposes the selected workflow to assistive tech via aria-current", () => {
    render(<WorkflowNavigator workflows={records} selectedWorkflowId="beta" onSelect={() => {}} />);

    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Alpha/ })).not.toHaveAttribute("aria-current");
  });
});
