/** Shared React Flow node/edge type aliases, kept separate so nodes/edges/canvas can all import
 * them without reaching into one another. */
import type { Edge, Node } from "@xyflow/react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { WorkflowConnection, WorkflowStep } from "@schema/workflow";
import type { Depth } from "../../store/useObservatoryStore";
import type { RoutedEdge } from "./edgeRouting";

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
  /** Present only when `edgeRouting.ts` decided this branch edge's direct path would clip
   * another node; `WorkflowEdge` renders this explicit sidecar route instead of its own
   * smoothstep curve. Undefined for the primary spine and for branch edges with a clear path. */
  route?: RoutedEdge;
}

export type WorkflowFlowEdge = Edge<WorkflowEdgeData, "workflow">;
