import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "../../api/types";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";
import { useObservatoryStore } from "../../store/useObservatoryStore";
import { buildFlowEdges, buildFlowNodes } from "./buildFlowElements";
import { CanvasHeader } from "./CanvasHeader";
import { CanvasOverflowIndicator } from "./CanvasOverflowIndicator";
import { computeEdgeRoutes } from "./edgeRouting";
import { EdgeMarkers } from "./edges/EdgeMarkers";
import { WorkflowEdge } from "./edges/WorkflowEdge";
import { computeLayout } from "./layout";
import { StepNode } from "./nodes/StepNode";
import type { StepFlowNode, WorkflowFlowEdge } from "./types";
import { useCanvasFit } from "./useCanvasFit";
import { useCanvasKeyboardNav } from "./useCanvasKeyboardNav";
import styles from "./WorkflowCanvas.module.css";

/** A minimap only earns its screen space once a graph is big enough to get lost in. */
const MINIMAP_NODE_THRESHOLD = 10;

const NODE_TYPES = { step: StepNode };
const EDGE_TYPES = { workflow: WorkflowEdge };

export interface WorkflowCanvasProps {
  workflow: Workflow;
  sourceChecks: Record<string, SourceStatus>;
}

/** Public entry point: owns the `ReactFlowProvider` so `useReactFlow` is available below it. */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowCanvasInner({ workflow, sourceChecks }: WorkflowCanvasProps) {
  const reactFlowInstance = useReactFlow<StepFlowNode, WorkflowFlowEdge>();
  const reducedMotion = usePrefersReducedMotion();

  const theme = useObservatoryStore((state) => state.theme);
  const depth = useObservatoryStore((state) => state.depth);
  const setDepth = useObservatoryStore((state) => state.setDepth);
  const expandedStepIds = useObservatoryStore((state) => state.expandedStepIds);
  const toggleStepExpanded = useObservatoryStore((state) => state.toggleStepExpanded);
  const collapseAllSteps = useObservatoryStore((state) => state.collapseAllSteps);
  const selectedStepId = useObservatoryStore((state) => state.selectedStepId);
  const selectStep = useObservatoryStore((state) => state.selectStep);

  const layout = useMemo(() => computeLayout(workflow, { depth, expandedStepIds }), [workflow, depth, expandedStepIds]);
  // Sidecar routes for branch edges whose direct path would clip an intervening spine card
  // (edgeRouting.ts) — computed once here so both edge rendering and viewport fitting agree on
  // exactly the same routed geometry.
  const edgeRoutes = useMemo(() => computeEdgeRoutes(layout.nodes, layout.edges), [layout]);

  const { containerRef, overflowsBottom, fitToViewport } = useCanvasFit({
    layoutNodes: layout.nodes,
    edgeRoutes,
    workflowId: workflow.id,
    depth,
    reactFlowInstance,
    reducedMotion,
  });

  const { getTabIndex, handleNodeKeyDown, setRovingId } = useCanvasKeyboardNav({
    workflow,
    layoutNodes: layout.nodes,
    containerRef,
    reactFlowInstance,
    selectedStepId,
    onSelect: selectStep,
    onClear: () => selectStep(null),
    reducedMotion,
  });

  const nodes = useMemo(
    () =>
      buildFlowNodes({
        workflow,
        layout,
        depth,
        expandedStepIds,
        sourceChecks,
        selectedStepId,
        getTabIndex,
        onToggleExpand: toggleStepExpanded,
        onNodeKeyDown: handleNodeKeyDown,
      }),
    [workflow, layout, depth, expandedStepIds, sourceChecks, selectedStepId, getTabIndex, toggleStepExpanded, handleNodeKeyDown],
  );
  const edges = useMemo(() => buildFlowEdges(layout, edgeRoutes), [layout, edgeRoutes]);

  const handleNodeClick: NodeMouseHandler<StepFlowNode> = (_event, node) => {
    selectStep(node.id);
    setRovingId(node.id);
  };

  const hasExpandedSteps = Object.keys(expandedStepIds).length > 0;
  const showMinimap = nodes.length > MINIMAP_NODE_THRESHOLD;

  return (
    <div className={styles.wrapper}>
      <CanvasHeader
        workflow={workflow}
        depth={depth}
        onDepthChange={setDepth}
        onFitView={() => fitToViewport(reducedMotion ? 0 : 300)}
        onZoomIn={() => void reactFlowInstance.zoomIn({ duration: reducedMotion ? 0 : 150 })}
        onZoomOut={() => void reactFlowInstance.zoomOut({ duration: reducedMotion ? 0 : 150 })}
        onCollapseAll={collapseAllSteps}
        collapseDisabled={!hasExpandedSteps}
      />
      <div className={styles.stage} ref={containerRef}>
        <EdgeMarkers />
        <ReactFlow
          className={styles.flow}
          colorMode={theme}
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          disableKeyboardA11y
          minZoom={0.2}
          maxZoom={2}
          onNodeClick={handleNodeClick}
          onPaneClick={() => selectStep(null)}
          aria-label={`${workflow.name} workflow canvas`}
        >
          {showMinimap ? <MiniMap pannable zoomable={false} ariaLabel={`${workflow.name} overview map`} /> : null}
        </ReactFlow>
        {overflowsBottom ? <CanvasOverflowIndicator /> : null}
      </div>
    </div>
  );
}
