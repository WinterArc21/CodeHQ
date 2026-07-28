/** Shared React Flow node/edge type aliases, kept separate so nodes/edges/canvas can all import
 * them without reaching into one another. */
import type { Edge, Node } from "@xyflow/react";
import type { KeyboardEvent as ReactKeyboardEvent, FocusEvent as ReactFocusEvent } from "react";
import type { WorkflowConnection, WorkflowStep } from "@schema/workflow";
import type { Depth } from "../../store/useObservatoryStore";
import type { RoutedEdge, Rect } from "./edgeRouting";

export interface StepNodeData extends Record<string, unknown> {
  step: WorkflowStep;
  index: number;
  effectiveDepth: Depth;
  expanded: boolean;
  selected: boolean;
  hasMissingSource: boolean;
  /** Path tracing (contract §11): true whenever a trace is active (something is hovered or
   * focused) and this step is neither the anchor nor on its upstream/downstream path. */
  dimmed: boolean;
  tabIndex: 0 | -1;
  onToggleExpand: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onFocusStep: (event: ReactFocusEvent<HTMLElement>) => void;
  onBlurStep: (event: ReactFocusEvent<HTMLElement>) => void;
}

export type StepFlowNode = Node<StepNodeData, "step">;

export interface OutcomeNodeData extends Record<string, unknown> {
  step: WorkflowStep;
  tone: "success" | "failure" | "neutral";
  dimmed: boolean;
  tabIndex: 0 | -1;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onFocusStep: (event: ReactFocusEvent<HTMLElement>) => void;
  onBlurStep: (event: ReactFocusEvent<HTMLElement>) => void;
}

export type OutcomeFlowNode = Node<OutcomeNodeData, "outcome">;

export interface ZoneLabelNodeData extends Record<string, unknown> {
  text: string;
}

/** A decorative "MAIN LINE" / "OUTCOMES" region header — not part of the workflow graph itself,
 * see `nodes/ZoneLabel.tsx`. */
export type ZoneLabelFlowNode = Node<ZoneLabelNodeData, "zoneLabel">;

/** Every node type the canvas can render — a work-step card, a terminal outcome pill, or a
 * decorative zone label. */
export type CanvasFlowNode = StepFlowNode | OutcomeFlowNode | ZoneLabelFlowNode;

export interface WorkflowEdgeData extends Record<string, unknown> {
  connection: WorkflowConnection;
  /** Present only when `edgeRouting.ts` decided this branch edge's direct path would clip
   * another node; `WorkflowEdge` renders this explicit sidecar route instead of its own
   * smoothstep curve. Undefined for the primary spine and for branch edges with a clear path. */
  route?: RoutedEdge;
  /** Present only when `canvas/graph.ts`'s `computeBackEdgeIds` identified this connection as a
   * retry/back edge — the source node's own rect, so `WorkflowEdge` can build a compact local
   * loop (`edgeRouting.ts`'s `buildRetryLoopPath`) instead of routing it like every other edge. */
  retryLoop?: Rect;
  /** Path tracing: true whenever a trace is active and this edge is not part of the anchor's
   * upstream/downstream path. */
  dimmed: boolean;
}

export type WorkflowFlowEdge = Edge<WorkflowEdgeData, "workflow">;
