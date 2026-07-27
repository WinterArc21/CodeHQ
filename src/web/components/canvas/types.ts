/** Shared React Flow node/edge type aliases, kept separate so nodes/edges/canvas can all import
 * them without reaching into one another. */
import type { Edge, Node } from "@xyflow/react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { WorkflowConnection, WorkflowStep } from "@schema/workflow";
import type { Depth } from "../../store/useObservatoryStore";

export interface StepNodeData extends Record<string, unknown> {
  step: WorkflowStep;
  index: number;
  effectiveDepth: Depth;
  expanded: boolean;
  selected: boolean;
  hasMissingSource: boolean;
  tabIndex: 0 | -1;
  onToggleExpand: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export type StepFlowNode = Node<StepNodeData, "step">;

export interface WorkflowEdgeData extends Record<string, unknown> {
  connection: WorkflowConnection;
}

export type WorkflowFlowEdge = Edge<WorkflowEdgeData, "workflow">;
