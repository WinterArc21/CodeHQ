/** Converts a `LayoutResult` plus current UI state into the plain node/edge arrays React Flow
 * renders. Kept out of `WorkflowCanvas.tsx` so that component stays focused on wiring. */
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Position } from "@xyflow/react";
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "../../api/types";
import type { Depth } from "../../store/useObservatoryStore";
import type { LayoutResult } from "./layout";
import { effectiveDepthForStep, stepHasMissingSource } from "./nodeContent";
import type { StepFlowNode, WorkflowFlowEdge } from "./types";

function isStepExpanded(expandedStepIds: Record<string, true>, stepId: string): boolean {
  return expandedStepIds[stepId] === true;
}

export interface BuildFlowNodesParams {
  workflow: Workflow;
  layout: LayoutResult;
  depth: Depth;
  expandedStepIds: Record<string, true>;
  sourceChecks: Record<string, SourceStatus>;
  selectedStepId: string | null;
  getTabIndex: (stepId: string) => 0 | -1;
  onToggleExpand: (stepId: string) => void;
  onNodeKeyDown: (event: ReactKeyboardEvent<HTMLElement>, stepId: string) => void;
}

export function buildFlowNodes(params: BuildFlowNodesParams): StepFlowNode[] {
  const stepById = new Map(params.workflow.steps.map((step) => [step.id, step] as const));

  return params.layout.nodes.map((layoutNode) => {
    const step = stepById.get(layoutNode.id);
    if (step === undefined) {
      // computeLayout only ever produces one LayoutNode per workflow.steps entry, so this
      // would mean layout and workflow have desynchronized — a programming error, not
      // something a malformed workflow file could trigger (schema validation already ran).
      throw new Error(`Layout produced a node for unknown step '${layoutNode.id}'.`);
    }

    return {
      id: layoutNode.id,
      type: "step",
      position: { x: layoutNode.x, y: layoutNode.y },
      width: layoutNode.width,
      height: layoutNode.height,
      // Matches the top-to-bottom layout: connections flow in on the top, out on the bottom,
      // so edges route cleanly downward instead of doubling back on themselves.
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        step,
        index: layoutNode.index,
        effectiveDepth: effectiveDepthForStep(step, params.depth, params.expandedStepIds),
        expanded: isStepExpanded(params.expandedStepIds, step.id),
        selected: step.id === params.selectedStepId,
        hasMissingSource: stepHasMissingSource(step, params.sourceChecks),
        tabIndex: params.getTabIndex(step.id),
        onToggleExpand: () => params.onToggleExpand(step.id),
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => params.onNodeKeyDown(event, step.id),
      },
    };
  });
}

export function buildFlowEdges(layout: LayoutResult): WorkflowFlowEdge[] {
  return layout.edges.map((edge) => ({
    id: edge.id,
    type: "workflow",
    source: edge.source,
    target: edge.target,
    focusable: false,
    data: { connection: edge.connection },
  }));
}
