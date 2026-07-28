/** Converts a `LayoutResult` plus current UI state into the plain node/edge arrays React Flow
 * renders. Kept out of `WorkflowCanvas.tsx` so that component stays focused on wiring. */
import type { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Position } from "@xyflow/react";
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "../../api/types";
import type { Depth } from "../../store/useObservatoryStore";
import { outcomeTone } from "../../design/semantics";
import type { RoutedEdge } from "./edgeRouting";
import { computeIncomingTypes } from "./graph";
import type { LayoutResult } from "./layout";
import { effectiveDepthForStep, stepHasMissingSource } from "./nodeContent";
import type { OutcomeFlowNode, StepFlowNode, WorkflowFlowEdge, ZoneLabelFlowNode } from "./types";

function isStepExpanded(expandedStepIds: Record<string, true>, stepId: string): boolean {
  return expandedStepIds[stepId] === true;
}

/** Shared hover/focus wiring every node (step or outcome) needs for path tracing (contract §11:
 * "Must work for keyboard focus too, not just mouse"). */
export interface TraceHandlers {
  onHoverStart: (stepId: string) => void;
  onHoverEnd: () => void;
  onFocusStep: (stepId: string) => void;
  onBlurStep: () => void;
}

export interface BuildFlowNodesParams extends TraceHandlers {
  workflow: Workflow;
  layout: LayoutResult;
  depth: Depth;
  expandedStepIds: Record<string, true>;
  sourceChecks: Record<string, SourceStatus>;
  selectedStepId: string | null;
  /** The active trace's full step set (anchor + upstream + downstream), or `null` when nothing
   * is hovered/focused/selected — every node dims when this is non-null and doesn't contain it. */
  traceStepIds: ReadonlySet<string> | null;
  getTabIndex: (stepId: string) => 0 | -1;
  onToggleExpand: (stepId: string) => void;
  onNodeKeyDown: (event: ReactKeyboardEvent<HTMLElement>, stepId: string) => void;
}

export function buildFlowNodes(params: BuildFlowNodesParams): Array<StepFlowNode | OutcomeFlowNode> {
  const stepById = new Map(params.workflow.steps.map((step) => [step.id, step] as const));
  const incomingTypesByStep = computeIncomingTypes(params.workflow);

  return params.layout.nodes.map((layoutNode): StepFlowNode | OutcomeFlowNode => {
    const step = stepById.get(layoutNode.id);
    if (step === undefined) {
      // computeLayout only ever produces one LayoutNode per workflow.steps entry, so this
      // would mean layout and workflow have desynchronized — a programming error, not
      // something a malformed workflow file could trigger (schema validation already ran).
      throw new Error(`Layout produced a node for unknown step '${layoutNode.id}'.`);
    }

    const dimmed = params.traceStepIds !== null && !params.traceStepIds.has(step.id);
    const traceHandlers = {
      onHoverStart: () => params.onHoverStart(step.id),
      onHoverEnd: params.onHoverEnd,
      onFocusStep: (_event: ReactFocusEvent<HTMLElement>) => params.onFocusStep(step.id),
      onBlurStep: (_event: ReactFocusEvent<HTMLElement>) => params.onBlurStep(),
    };

    if (layoutNode.isOutcome) {
      return {
        id: layoutNode.id,
        type: "outcome",
        position: { x: layoutNode.x, y: layoutNode.y },
        width: layoutNode.width,
        height: layoutNode.height,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          step,
          tone: outcomeTone(incomingTypesByStep.get(step.id) ?? []),
          dimmed,
          tabIndex: params.getTabIndex(step.id),
          onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => params.onNodeKeyDown(event, step.id),
          ...traceHandlers,
        },
      };
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
        dimmed,
        tabIndex: params.getTabIndex(step.id),
        onToggleExpand: () => params.onToggleExpand(step.id),
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => params.onNodeKeyDown(event, step.id),
        ...traceHandlers,
      },
    };
  });
}

export function buildFlowEdges(
  layout: LayoutResult,
  routes: ReadonlyMap<string, RoutedEdge>,
  backEdgeIds: ReadonlySet<string>,
  traceEdgeIds: ReadonlySet<string> | null,
): WorkflowFlowEdge[] {
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node] as const));

  return layout.edges.map((edge) => {
    const route = routes.get(edge.id);
    // Only a literal self-loop means retry. Other DFS back edges retain their declared
    // connection semantics and use the sidecar route computed by edgeRouting.
    const isRetryLoop = backEdgeIds.has(edge.id) && edge.source === edge.target;
    const sourceNode = nodeById.get(edge.source);
    const dimmed = traceEdgeIds !== null && !traceEdgeIds.has(edge.id);

    return {
      id: edge.id,
      type: "workflow",
      source: edge.source,
      target: edge.target,
      focusable: false,
      data: {
        connection: edge.connection,
        dimmed,
        ...(route !== undefined ? { route } : {}),
        ...(isRetryLoop && sourceNode !== undefined
          ? { retryLoop: { x: sourceNode.x, y: sourceNode.y, width: sourceNode.width, height: sourceNode.height } }
          : {}),
      },
    };
  });
}

/** How far above the topmost node's own top edge a zone label sits — small enough to stay inside
 * `layout.ts`'s `LAYOUT_MARGIN_Y` (28px) top margin, so the fitted viewport's own padding already
 * covers it without needing to widen the graph's own fit bounds for a purely decorative label. */
const ZONE_LABEL_GAP_ABOVE = 20;

/**
 * The "MAIN LINE" / "OUTCOMES" quiet-zone headers the mockup uses to orient a first-time reader
 * (`prototypes/edge-grammar`) — both anchored to the same y (the whole graph's own topmost row),
 * one over the main-line column's leftmost x, one over the outcome column's leftmost x, so they
 * read as a single header spanning the two regions rather than two independently-placed labels.
 * Either half is omitted when that region has no nodes at all (e.g. a workflow with no terminal
 * outcomes yet). Not part of `layout.ts`'s own node set — these never affect graph geometry,
 * routing, overlap checks, or the minimap's node count, purely a rendering-layer annotation.
 */
export function buildZoneLabelNodes(layout: LayoutResult): ZoneLabelFlowNode[] {
  if (layout.nodes.length === 0) {
    return [];
  }
  const usedIds = new Set(layout.nodes.map((node) => node.id));
  const mainLineNodes = layout.nodes.filter((node) => !node.isOutcome);
  const outcomeNodes = layout.nodes.filter((node) => node.isOutcome);
  const topY = Math.min(...layout.nodes.map((node) => node.y)) - ZONE_LABEL_GAP_ABOVE;

  const specs: Array<{ id: string; text: string; x: number }> = [];
  const isTrueSingleColumn = mainLineNodes.length > 0 && mainLineNodes.every((node) => node.x === mainLineNodes[0]?.x);
  if (isTrueSingleColumn) {
    specs.push({ id: "__zone-label-main-line", text: "Main line", x: Math.min(...mainLineNodes.map((node) => node.x)) });
  }
  if (outcomeNodes.length > 0) {
    specs.push({ id: "__zone-label-outcomes", text: "Outcomes", x: Math.min(...outcomeNodes.map((node) => node.x)) });
  }

  return specs
    .filter((spec) => !usedIds.has(spec.id)) // a real step id could theoretically collide
    .map((spec) => ({
      id: spec.id,
      type: "zoneLabel",
      position: { x: spec.x, y: topY },
      draggable: false,
      selectable: false,
      focusable: false,
      data: { text: spec.text },
    }));
}
