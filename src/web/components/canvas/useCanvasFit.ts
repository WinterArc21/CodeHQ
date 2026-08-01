/**
 * Owns the canvas's viewport-fitting behaviour — split out of `WorkflowCanvas.tsx` (contract §12:
 * "no React component file over ~200 lines") along the seam that was already documented there as
 * a distinct concern from node/edge wiring: computing the graph's bounding box, deciding the
 * fitted zoom/position via `fitViewport.ts`, and the two effects that apply it (a synchronous
 * re-fit on workflow/depth change, and a one-shot fallback for the container's very first real
 * layout).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Depth } from "../../store/useCodeHQStore";
import type { RoutedEdge } from "./edgeRouting";
import { computeFitViewport } from "./fitViewport";
import type { LayoutNode } from "./layout";

/** Small margin around the fitted graph — kept tight deliberately: a generous margin here is
 * exactly what produced the old "80% empty canvas" failure. */
const FIT_VIEW_PADDING = 0.06;
/** `fitView`'s computed zoom is clamped to this floor so a large workflow anchors at a legible
 * scale and relies on panning instead of shrinking into illegibility (contract §1: "clamp the
 * minimum default zoom to something legible"). */
const FIT_VIEW_MIN_ZOOM = 0.78;
/** A small workflow should not zoom in past "designed", pixel-doubled scale. */
const FIT_VIEW_MAX_ZOOM = 1.1;
/** How far a routed edge's label chip can extend past its own lane's centreline — folded into
 * the fit bounds so a sidecar route's label is never the thing that gets cropped at the fitted
 * zoom (`edgeRouting.ts` centres each label on `route.labelPoint`). */
const ROUTE_LABEL_HALF_WIDTH = 60;

export interface UseCanvasFitParams {
  layoutNodes: LayoutNode[];
  edgeRoutes: ReadonlyMap<string, RoutedEdge>;
  workflowId: string;
  /** Stable serialization of the valid workflow content. Changes when a live semantic edit can
   * alter graph bounds, but not for source-check-only snapshots or local expansion state. */
  workflowRevision: string;
  depth: Depth;
  reactFlowInstance: Pick<ReactFlowInstance, "setViewport">;
  reducedMotion: boolean;
}

export interface UseCanvasFitResult {
  containerRef: RefObject<HTMLDivElement | null>;
  overflowsBottom: boolean;
  fitToViewport: (duration: number) => void;
}

function computeGraphBounds(
  nodes: LayoutNode[],
  edgeRoutes: ReadonlyMap<string, RoutedEdge>,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (nodes.length === 0) {
    return null;
  }
  let minX = Math.min(...nodes.map((node) => node.x));
  let minY = Math.min(...nodes.map((node) => node.y));
  let maxX = Math.max(...nodes.map((node) => node.x + node.width));
  let maxY = Math.max(...nodes.map((node) => node.y + node.height));

  // A sidecar route's lane (and its label chip) can sit to the right of every node — fold it
  // into the fit bounds so a branch's failure path is never the part of the graph that gets
  // panned out of view at the fitted zoom.
  for (const route of edgeRoutes.values()) {
    for (const point of route.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    maxX = Math.max(maxX, route.labelPoint.x + ROUTE_LABEL_HALF_WIDTH);
  }

  return { minX, minY, maxX, maxY };
}

export function useCanvasFit(params: UseCanvasFitParams): UseCanvasFitResult {
  const { layoutNodes, edgeRoutes, workflowId, workflowRevision, depth, reactFlowInstance, reducedMotion } = params;
  const containerRef = useRef<HTMLDivElement>(null);
  // Whether the fitted graph still has more content below the visible stage — a deeper depth
  // (`modules`/`symbols` grow every node) or a large workflow can be taller than even the
  // minimum legible zoom allows. Drives the "more below" affordance so a reader never mistakes a
  // cut-off last card for the end of the workflow.
  const [overflowsBottom, setOverflowsBottom] = useState(false);

  const fitToViewport = useCallback(
    (duration: number) => {
      const container = containerRef.current;
      const bounds = computeGraphBounds(layoutNodes, edgeRoutes);
      if (container === null || bounds === null) {
        return;
      }
      const rect = container.getBoundingClientRect();
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
        setOverflowsBottom(viewport.overflowsBottom);
      }
    },
    [layoutNodes, edgeRoutes, reactFlowInstance],
  );

  // `useLayoutEffect`, not `useEffect`: the fit must be computed and applied before the browser
  // paints, or the very first frame flashes React Flow's own default viewport (top-left, zoom 1)
  // before snapping to the fitted one.
  useLayoutEffect(() => {
    fitToViewport(reducedMotion ? 0 : 400);
    // Re-fit on a new workflow, a valid live workflow-content update, or a global depth change
    // (contract §11). Expanding a single step, selecting a step, or a source-check-only update
    // must never re-frame the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, workflowRevision, depth]);

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

  return { containerRef, overflowsBottom, fitToViewport };
}
