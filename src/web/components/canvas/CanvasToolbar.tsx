import { ArrowsInLineVertical, DownloadSimple, MagnifyingGlassMinus, MagnifyingGlassPlus, Trash } from "@phosphor-icons/react";
import { IconButton } from "../primitives";
import styles from "./CanvasToolbar.module.css";

export interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCollapseAll: () => void;
  collapseDisabled: boolean;
  /** When provided, an export button is shown. Omitted in the export viewer. */
  onExport?: () => void;
  /** Only available for a completed workflow in the live app. */
  onDelete?: () => void;
}

/** The small set of canvas actions that remain useful in the workflow surface. */
export function CanvasToolbar({ onZoomIn, onZoomOut, onCollapseAll, collapseDisabled, onExport, onDelete }: CanvasToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.zoomGroup}>
        <IconButton label="Zoom in" icon={<MagnifyingGlassPlus size={16} />} size="sm" onClick={onZoomIn} />
        <IconButton label="Zoom out" icon={<MagnifyingGlassMinus size={16} />} size="sm" onClick={onZoomOut} />
      </div>
      <div className={styles.divider} aria-hidden="true" />
      <IconButton
        label="Collapse all expanded steps"
        icon={<ArrowsInLineVertical size={16} />}
        size="sm"
        onClick={onCollapseAll}
        disabled={collapseDisabled}
      />
      {onExport !== undefined ? (
        <>
          <div className={styles.divider} aria-hidden="true" />
          <IconButton label="Export canvas" icon={<DownloadSimple size={16} />} size="sm" onClick={onExport} />
        </>
      ) : null}
      {onDelete !== undefined ? (
        <>
          <div className={styles.divider} aria-hidden="true" />
          <IconButton label="Delete workflow" icon={<Trash size={16} />} size="sm" onClick={onDelete} />
        </>
      ) : null}
    </div>
  );
}
