/** Shared React Flow node/edge type aliases, kept separate so nodes/edges/canvas can all import
 * them without reaching into one another. */
import type { Edge, Node } from "@xyflow/react";
import type { KeyboardEvent as ReactKeyboardEvent, FocusEvent as ReactFocusEvent } from "react";
import type { WorkflowConnection, WorkflowStep } from "@schema/workflow";
import type { Depth } from "../../store/useHQStore";
import type { RoutedEdge, Rect } from "./edgeRouting";

export interface StepNodeData extends Record<string, unknown> {
  step: WorkflowStep;
  index: number;
  effectiveDepth: Depth;
  expanded: boolean;
  selected: boolean;
  hasMissingSource: boolean;
  /** Path tracing: true whenever a trace is active and this step is outside the anchor's one-hop
   * upstream/downstream neighborhood. */
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
  /** Decorative labels dim with the rest of the canvas while a trace is active. */
  dimmed: boolean;
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
  /** Path tracing: true whenever a trace is active and this edge is not an outgoing edge from the
   * anchor. */
  dimmed: boolean;
  /** Path tracing: true whenever a trace is active and this edge is an outgoing edge from the
   * anchor. Distinct from `!dimmed` (which is also true when no trace is active at all) so the
   * renderer can strengthen the highlighted edges only while tracing, never on the resting graph. */
  traced: boolean;
}

export type WorkflowFlowEdge = Edge<WorkflowEdgeData, "workflow">;
