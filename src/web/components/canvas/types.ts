/** Shared React Flow node/edge type aliases, kept separate so nodes/edges/canvas can all import
 * them without reaching into one another. */
import type { Edge, Node } from "@xyflow/react";
import type { KeyboardEvent as ReactKeyboardEvent, FocusEvent as ReactFocusEvent } from "react";
import type { WorkflowConnection, WorkflowStep } from "@schema/workflow";
import type { Depth } from "../../store/useCodeHQStore";
import type { OutcomeBand } from "./layout";

export interface StepNodeData extends Record<string, unknown> {
  step: WorkflowStep;
  index: number;
  effectiveDepth: Depth;
  expanded: boolean;
  selected: boolean;
  hasMissingSource: boolean;
  hasFailureOutcome?: boolean;
  hasSuccessOutcome?: boolean;
  hasRetry?: boolean;
  hasReturnIn?: boolean;
  hasReturnOut?: boolean;
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
  band: OutcomeBand;
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
  /** A literal self-loop. Retry geometry uses React Flow's live handle coordinates so moving the
   * card can never leave its loop behind. */
  retry?: boolean;
  /** A non-self back edge. It uses live top-side handles and a raised return arc so it never cuts
   * through the horizontal mainline. */
  returnEdge?: boolean;
  /** A connection into a terminal outcome. These retain their semantic top/bottom branch route
   * while ordinary work-step connections can switch to any facing pair of card sides. */
  branch?: boolean;
  /** Path tracing: true whenever a trace is active and this edge is not an outgoing edge from the
   * anchor. */
  dimmed: boolean;
  /** Path tracing: true whenever a trace is active and this edge is an outgoing edge from the
   * anchor. Distinct from `!dimmed` (which is also true when no trace is active at all) so the
   * renderer can strengthen the highlighted edges only while tracing, never on the resting graph. */
  traced: boolean;
}

export type WorkflowFlowEdge = Edge<WorkflowEdgeData, "workflow">;
