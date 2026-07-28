import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import type { WorkflowStep } from "@schema/workflow";
import { StepNode } from "@web/components/canvas/nodes/StepNode";
import type { StepFlowNode, StepNodeData } from "@web/components/canvas/types";

/**
 * `StepNode` is tested in isolation from the full `WorkflowCanvas`/React Flow tree: React Flow
 * relies on real layout measurement (`ResizeObserver`, viewport sizing) that jsdom cannot
 * faithfully provide, but `StepNode` itself is a plain component that only reads `data` off the
 * `NodeProps` React Flow would normally supply — so it's exercised directly here. It still needs
 * a `ReactFlowProvider` ancestor: the node's `<Handle>` elements (required for edges to attach)
 * read from React Flow's store context even when rendered outside a full `<ReactFlow>` tree.
 */
function renderStepNode(props: NodeProps<StepFlowNode>) {
  return render(
    <ReactFlowProvider>
      <StepNode {...props} />
    </ReactFlowProvider>,
  );
}
function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: "scrape-website",
    name: "Scrape Website",
    purpose: "Fetches the submitted pages and extracts useful text.",
    category: "logic",
    confidence: "verified",
    ...overrides,
  };
}

function makeData(overrides: Partial<StepNodeData> = {}): StepNodeData {
  return {
    step: makeStep(),
    index: 2,
    effectiveDepth: "workflow",
    expanded: false,
    selected: false,
    hasMissingSource: false,
    dimmed: false,
    tabIndex: -1,
    onToggleExpand: () => {},
    onKeyDown: () => {},
    onHoverStart: () => {},
    onHoverEnd: () => {},
    onFocusStep: () => {},
    onBlurStep: () => {},
    ...overrides,
  };
}

function makeProps(data: StepNodeData): NodeProps<StepFlowNode> {
  return {
    id: data.step.id,
    data,
    type: "step",
    dragging: false,
    zIndex: 0,
    selectable: true,
    deletable: false,
    selected: data.selected,
    draggable: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
}

describe("StepNode", () => {
  it("renders the name, one-line purpose, category, and confidence when collapsed", () => {
    renderStepNode(makeProps(makeData()));
    expect(screen.getByText("Scrape Website")).toBeInTheDocument();
    expect(screen.getByText("Fetches the submitted pages and extracts useful text.")).toBeInTheDocument();
    expect(screen.getByText("Logic")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("shows a compact count only when it is greater than zero", () => {
    const data = makeData({
      step: makeStep({
        sources: [{ file: "lib/scraper.ts", symbol: "scrapeWebsite" }],
        edgeCases: [{ name: "Website blocks automated requests" }],
      }),
    });
    renderStepNode(makeProps(data));
    expect(screen.getByText("1 source · 1 edge case")).toBeInTheDocument();
  });

  it("renders no facts row at all when there are no counts and no inputs/outputs", () => {
    renderStepNode(makeProps(makeData()));
    expect(screen.queryByText(/source|edge case|test/)).not.toBeInTheDocument();
  });

  it("surfaces inputs and outputs compactly on the collapsed card", () => {
    const data = makeData({
      step: makeStep({
        inputs: [{ name: "ScrapedWebsite" }],
        outputs: [{ name: "ProductContext" }],
      }),
    });
    renderStepNode(makeProps(data));
    expect(screen.getByText("ScrapedWebsite")).toBeInTheDocument();
    expect(screen.getByText("ProductContext")).toBeInTheDocument();
    expect(screen.getByText("in")).toBeInTheDocument();
    expect(screen.getByText("out")).toBeInTheDocument();
  });

  it("lists distinct source files at depth 'modules'", () => {
    const data = makeData({
      effectiveDepth: "modules",
      step: makeStep({
        sources: [
          { file: "lib/scraper.ts", symbol: "scrapeWebsite" },
          { file: "lib/validation.ts" },
        ],
      }),
    });
    renderStepNode(makeProps(data));
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("scraper.ts")).toBeInTheDocument();
    expect(screen.getByText("validation.ts")).toBeInTheDocument();
  });

  it("caps the file list and shows a '+N more' line beyond the maximum", () => {
    const data = makeData({
      effectiveDepth: "modules",
      step: makeStep({
        sources: Array.from({ length: 7 }, (_, i) => ({ file: `lib/file-${i}.ts` })),
      }),
    });
    renderStepNode(makeProps(data));
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("has a real, accessible expand control that toggles", async () => {
    const onToggleExpand = vi.fn();
    renderStepNode(makeProps(makeData({ onToggleExpand })));
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: /expand scrape website/i });
    await user.click(button);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it("exposes a 'collapse' accessible name once expanded", () => {
    renderStepNode(makeProps(makeData({ expanded: true })));
    expect(screen.getByRole("button", { name: /collapse scrape website/i })).toBeInTheDocument();
  });

  it("surfaces a missing-sources warning affordance when a source check is missing", () => {
    renderStepNode(makeProps(makeData({ hasMissingSource: true })));
    expect(screen.getByText("Missing sources")).toBeInTheDocument();
  });

  it("does not surface the warning affordance when nothing is missing", () => {
    renderStepNode(makeProps(makeData()));
    expect(screen.queryByText("Missing sources")).not.toBeInTheDocument();
  });
});
