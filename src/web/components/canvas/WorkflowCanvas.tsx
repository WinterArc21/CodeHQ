import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "../../api/types";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";
import { useObservatoryStore } from "../../store/useObservatoryStore";
import { buildFlowEdges, buildFlowNodes } from "./buildFlowElements";
import { CanvasHeader } from "./CanvasHeader";
import { EdgeMarkers } from "./edges/EdgeMarkers";
import { WorkflowEdge } from "./edges/WorkflowEdge";
import { computeFitViewport } from "./fitViewport";
import { computeLayout } from "./layout";
import { StepNode } from "./nodes/StepNode";
import type { StepFlowNode, WorkflowFlowEdge } from "./types";
import { useCanvasKeyboardNav } from "./useCanvasKeyboardNav";
import styles from "./WorkflowCanvas.module.css";

/** A minimap only earns its screen space once a graph is big enough to get lost in. */
const MINIMAP_NODE_THRESHOLD = 10;
/** Small margin around the fitted graph — kept tight deliberately: the old 0.2 (20% of the
 * viewport reserved as empty margin on every side) is exactly what produced the "80% empty
 * canvas" failure this redesign fixes. */
const FIT_VIEW_PADDING = 0.06;
/** `fitView`'s computed zoom is clamped to this floor so a large workflow anchors at a legible
 * scale and relies on panning instead of shrinking into illegibility (contract §1: "clamp the
 * minimum default zoom to something legible"). At this zoom the 17px step-name font (`--fs-lg`)
 * still renders at ~13px effective size, the acceptance floor. */
const FIT_VIEW_MIN_ZOOM = 0.78;
/** A small workflow should not zoom in past "designed", pixel-doubled scale. */
const FIT_VIEW_MAX_ZOOM = 1.1;

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
  const containerRef = useRef<HTMLDivElement>(null);
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
  const edges = useMemo(() => buildFlowEdges(layout), [layout]);

  const fitToViewport = useCallback(
    (duration: number) => {
      const container = containerRef.current;
      if (container === null || layout.nodes.length === 0) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const bounds = {
        minX: Math.min(...layout.nodes.map((node) => node.x)),
        minY: Math.min(...layout.nodes.map((node) => node.y)),
        maxX: Math.max(...layout.nodes.map((node) => node.x + node.width)),
        maxY: Math.max(...layout.nodes.map((node) => node.y + node.height)),
      };
      const viewport = computeFitViewport({
        containerWidth: rect.width,
        containerHeight: rect.height,
        bounds,
        minZoom: FIT_VIEW_MIN_ZOOM,
        maxZoom: FIT_VIEW_MAX_ZOOM,
        paddingRatio: FIT_VIEW_PADDING,
      });
      if (viewport !== null) {
        void reactFlowInstance.setViewport(viewport, { duration });
      }
    },
    [layout.nodes, reactFlowInstance],
  );

  // `useLayoutEffect`, not `useEffect`: the fit must be computed and applied before the browser
  // paints, or the very first frame flashes React Flow's own default viewport (top-left, zoom 1)
  // before snapping to the fitted one.
  useLayoutEffect(() => {
    fitToViewport(reducedMotion ? 0 : 400);
    // Re-fit only on a new workflow or a global depth change (contract §11) — expanding a single
    // step, selecting a step, or a source-check update must never re-frame the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id, depth]);

  // One-shot fallback for the very first mount: the app auto-selects the default workflow from
  // a *regular* `useEffect` in `App.tsx` (necessarily async — it reacts to the server snapshot
  // arriving), so this component's first commit can land before the flex-column chain above it
  // has settled into its final size. If that happens, `fitToViewport` above computed against a
  // zero-size container and silently did nothing, leaving React Flow's raw default viewport on
  // screen. Watch for the container's first real size and fit exactly once when it appears; it
  // then disconnects, so it never fights a user's manual pan/zoom on a later resize.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        fitToViewport(0);
        observer.disconnect();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
    // Deliberately mount-scoped: only ever needs to catch the first real layout, not every
    // resize (contract §11: the viewport must not re-frame on anything but a workflow/depth
    // change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      </div>
    </div>
  );
}
