import { ArrowsInLineVertical, ArrowsOut, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import type { Depth } from "../../store/useObservatoryStore";
import { IconButton } from "../primitives";
import { DepthControl } from "./DepthControl";
import styles from "./CanvasToolbar.module.css";

export interface CanvasToolbarProps {
  depth: Depth;
  onDepthChange: (depth: Depth) => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCollapseAll: () => void;
  collapseDisabled: boolean;
}

/**
 * The canvas's own chrome (contract §11): depth control, fit-to-view, zoom in/out, and
 * collapse-all-expanded — real buttons with accessible names, not React Flow's default
 * `<Controls />` panel (which has no room for a depth switch or a collapse-all action).
 */
export function CanvasToolbar({
  depth,
  onDepthChange,
  onFitView,
  onZoomIn,
  onZoomOut,
  onCollapseAll,
  collapseDisabled,
}: CanvasToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <DepthControl depth={depth} onChange={onDepthChange} />
      <div className={styles.divider} aria-hidden="true" />
      <div className={styles.zoomGroup}>
        <IconButton label="Zoom in" icon={<MagnifyingGlassPlus size={16} />} size="sm" onClick={onZoomIn} />
        <IconButton label="Zoom out" icon={<MagnifyingGlassMinus size={16} />} size="sm" onClick={onZoomOut} />
        <IconButton label="Fit to view" icon={<ArrowsOut size={16} />} size="sm" onClick={onFitView} />
      </div>
      <div className={styles.divider} aria-hidden="true" />
      <IconButton
        label="Collapse all expanded steps"
        icon={<ArrowsInLineVertical size={16} />}
        size="sm"
        onClick={onCollapseAll}
        disabled={collapseDisabled}
      />
    </div>
  );
}
