import "@xyflow/react/dist/style.css";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MiniMap, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type NodeMouseHandler } from "@xyflow/react";
import type { Workflow } from "@schema/workflow";
import type { SourceStatus } from "../../api/types";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";
import { useCodeHQStore } from "../../store/useCodeHQStore";
import { buildFlowEdges, buildFlowNodes, buildZoneLabelNodes } from "./buildFlowElements";
import { CanvasLegend } from "./CanvasLegend";
import { CanvasHeader } from "./CanvasHeader";
import { CanvasOverflowIndicator } from "./CanvasOverflowIndicator";
import { EdgeMarkers } from "./edges/EdgeMarkers";
import { WorkflowEdge } from "./edges/WorkflowEdge";
import { computeBackEdgeIds, computeTracePath } from "./graph";
import { computeLayout } from "./layout";
import { OutcomeNode } from "./nodes/OutcomeNode";
import { StepNode } from "./nodes/StepNode";
import { ZoneLabel } from "./nodes/ZoneLabel";
import type { CanvasFlowNode, WorkflowFlowEdge } from "./types";
import { useExportMode } from "../../export-viewer/ExportModeContext";
import { fetchWorkflowExport } from "../../api/client";
import { DeleteWorkflowDialog } from "./DeleteWorkflowDialog";
import { ExportDialog } from "./ExportDialog";
import { useCanvasFit } from "./useCanvasFit";
import { useCanvasKeyboardNav } from "./useCanvasKeyboardNav";
import styles from "./WorkflowCanvas.module.css";

/** A minimap only earns its screen space once a graph is big enough to get lost in. Counted over
 * work-step nodes only, not outcome pills: an outcome is an endpoint a reader glances at, not
 * another unit of work to navigate, so a workflow with a handful of steps and a stack of outcome
 * pills beside them (post edge-grammar redesign, outcomes are now real nodes) should not suddenly
 * earn a minimap it didn't need when outcomes were just coloured terminal markers. Both bundled
 * example workflows (7 and 4 work steps) confirm this keeps the default 1440x900 view intrusion-
 * free while still growing in for a genuinely large workflow. */
const MINIMAP_NODE_THRESHOLD = 10;

const NODE_TYPES = { step: StepNode, outcome: OutcomeNode, zoneLabel: ZoneLabel };
const EDGE_TYPES = { workflow: WorkflowEdge };

export interface WorkflowCanvasProps {
  workflow: Workflow;
  sourceChecks: Record<string, SourceStatus>;
  onDeleteWorkflow?: () => Promise<void>;
}

/** Public entry point: owns the `ReactFlowProvider` so `useReactFlow` is available below it. */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowCanvasInner({ workflow, sourceChecks, onDeleteWorkflow }: WorkflowCanvasProps) {
  const reactFlowInstance = useReactFlow<CanvasFlowNode, WorkflowFlowEdge>();
  const reducedMotion = usePrefersReducedMotion();
  const exportMode = useExportMode();
  // A valid live edit keeps the same workflow id, so the id alone cannot tell `useCanvasFit`
  // that the graph's bounds changed. Source-check-only snapshots keep the workflow byte-identical
  // and therefore retain this key, avoiding an unnecessary reframe.
  const workflowRevision = useMemo(() => JSON.stringify(workflow), [workflow]);

  const theme = useCodeHQStore((state) => state.theme);
  const depth = useCodeHQStore((state) => state.depth);
  const setDepth = useCodeHQStore((state) => state.setDepth);
  const expandedStepIds = useCodeHQStore((state) => state.expandedStepIds);
  const toggleStepExpanded = useCodeHQStore((state) => state.toggleStepExpanded);
  const collapseAllSteps = useCodeHQStore((state) => state.collapseAllSteps);
  const selectedStepId = useCodeHQStore((state) => state.selectedStepId);
  const selectStep = useCodeHQStore((state) => state.selectStep);

  const layout = useMemo(() => computeLayout(workflow, { depth, expandedStepIds }), [workflow, depth, expandedStepIds]);
  const backEdgeIds = useMemo(() => computeBackEdgeIds(workflow), [workflow]);

  // Path tracing (contract §11): hover wins over keyboard focus, which wins over the persisted
  // selection, matching how each one takes over the user's attention — a hover is the most
  // momentary/explicit signal, selection the most passive/lingering one.
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const realStepIds = useMemo(() => new Set(workflow.steps.map((step) => step.id)), [workflow]);
  const candidateTraceAnchorId = hoveredStepId ?? focusedStepId ?? selectedStepId;
  const traceAnchorId = candidateTraceAnchorId !== null && realStepIds.has(candidateTraceAnchorId) ? candidateTraceAnchorId : null;
  const tracePath = useMemo(
    () => (traceAnchorId !== null ? computeTracePath(workflow, traceAnchorId) : null),
    [workflow, traceAnchorId],
  );
  const onHoverStart = useCallback((stepId: string) => setHoveredStepId(stepId), []);
  const onHoverEnd = useCallback(() => setHoveredStepId(null), []);
  const onFocusStep = useCallback((stepId: string) => setFocusedStepId(stepId), []);
  const onBlurStep = useCallback(() => setFocusedStepId(null), []);
  const handleClearSelection = useCallback(() => selectStep(null), [selectStep]);

  const { containerRef, overflowsBottom } = useCanvasFit({
    layoutNodes: layout.nodes,
    workflowId: workflow.id,
    workflowRevision,
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
    onClear: handleClearSelection,
    reducedMotion,
  });

  const generatedNodes = useMemo(
    () => [
      ...buildFlowNodes({
        workflow,
        layout,
        backEdgeIds,
        depth,
        expandedStepIds,
        sourceChecks,
        selectedStepId,
        traceStepIds: tracePath?.stepIds ?? null,
        getTabIndex,
        onToggleExpand: toggleStepExpanded,
        onNodeKeyDown: handleNodeKeyDown,
        onHoverStart,
        onHoverEnd,
        onFocusStep,
        onBlurStep,
      }),
      ...buildZoneLabelNodes(layout, tracePath !== null),
    ],
    [
      workflow,
      layout,
      backEdgeIds,
      depth,
      expandedStepIds,
      sourceChecks,
      selectedStepId,
      tracePath,
      getTabIndex,
      toggleStepExpanded,
      handleNodeKeyDown,
      onHoverStart,
      onHoverEnd,
      onFocusStep,
      onBlurStep,
    ],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(generatedNodes);
  const previousWorkflowId = useRef(workflow.id);
  useLayoutEffect(() => {
    const reset = previousWorkflowId.current !== workflow.id;
    previousWorkflowId.current = workflow.id;
    setNodes((current) => {
      const positions = new Map(current.filter((node) => node.type !== "zoneLabel").map((node) => [node.id, node.position]));
      return generatedNodes.map((node) => reset || node.type === "zoneLabel" ? node : { ...node, position: positions.get(node.id) ?? node.position });
    });
  }, [generatedNodes, setNodes, workflow.id]);
  const edges = useMemo(
    () => buildFlowEdges(layout, backEdgeIds, tracePath?.edgeIds ?? null),
    [layout, backEdgeIds, tracePath],
  );

  const handleNodeClick: NodeMouseHandler<CanvasFlowNode> = (_event, node) => {
    if (node.type === "zoneLabel") {
      return;
    }
    selectStep(node.id);
    setRovingId(node.id);
  };

  const handleExport = useCallback(() => setExportDialogOpen(true), []);
  const downloadExport = useCallback(async (hideFilePaths: boolean): Promise<void> => {
    const artifact = await fetchWorkflowExport(workflow.id, hideFilePaths);
    const url = URL.createObjectURL(artifact.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = artifact.filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [workflow.id]);
  const shareExport = useCallback(async (hideFilePaths: boolean): Promise<void> => {
    const artifact = await fetchWorkflowExport(workflow.id, hideFilePaths);
    const file = new File([artifact.blob], artifact.filename, { type: "text/html" });
    const shareData = { files: [file], title: workflow.name, text: "HQFlow workflow export" };
    if (typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      return;
    }
    await downloadExport(hideFilePaths);
  }, [downloadExport, workflow.id, workflow.name]);

  const hasExpandedSteps = Object.keys(expandedStepIds).length > 0;
  const stepNodeCount = nodes.filter((node) => node.type === "step").length;
  const showMinimap = stepNodeCount > MINIMAP_NODE_THRESHOLD;

  return (
    <div className={styles.wrapper}>
      <CanvasHeader
        workflow={workflow}
        depth={depth}
        onDepthChange={setDepth}
        onZoomIn={() => void reactFlowInstance.zoomIn({ duration: reducedMotion ? 0 : 150 })}
        onZoomOut={() => void reactFlowInstance.zoomOut({ duration: reducedMotion ? 0 : 150 })}
        onCollapseAll={collapseAllSteps}
        collapseDisabled={!hasExpandedSteps}
        {...(exportMode === null ? { onExport: handleExport } : {})}
        {...(exportMode === null && onDeleteWorkflow !== undefined && workflow.status === "verified"
          ? { onDelete: () => setDeleteDialogOpen(true) }
          : {})}
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
          nodesDraggable
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          disableKeyboardA11y
          minZoom={0.2}
          maxZoom={2}
          onNodeClick={handleNodeClick}
          onNodesChange={onNodesChange}
          onPaneClick={handleClearSelection}
          aria-label={`${workflow.name} workflow canvas`}
        >
          {showMinimap ? <MiniMap pannable zoomable={false} ariaLabel={`${workflow.name} overview map`} /> : null}
        </ReactFlow>
        <CanvasLegend workflow={workflow} dimmed={tracePath !== null} />
        {overflowsBottom ? <CanvasOverflowIndicator /> : null}
      </div>
      {exportDialogOpen ? (
        <ExportDialog
          workflowName={workflow.name}
          onClose={() => setExportDialogOpen(false)}
          onDownload={downloadExport}
          onShare={shareExport}
        />
      ) : null}
      {deleteDialogOpen && onDeleteWorkflow !== undefined ? (
        <DeleteWorkflowDialog
          workflowName={workflow.name}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={async () => {
            await onDeleteWorkflow();
            setDeleteDialogOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
