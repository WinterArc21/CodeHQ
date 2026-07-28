/**
 * Pure geometry for a connection's label chip — shared by `layout.ts` (which sizes the rank gap
 * around it so a labelled primary edge's chip always has room to sit in) and `WorkflowEdge.tsx`
 * (which renders exactly this point). Splitting this out of the component is what makes the fix
 * to the "clean" label sitting on top of `persist-asset`'s border a real one instead of a nudged
 * constant: the layout and the renderer now agree on one formula for where a direct edge's label
 * lands, so a rank gap sized to contain it can never quietly drift out of sync with what actually
 * paints.
 */
import type { LayoutNode } from "./layout";
import { EDGE_LABEL_CHIP_HEIGHT } from "./nodeContent";

export interface Point {
  x: number;
  y: number;
}

/** How far horizontally to blend a label from the source's x toward the target's x. Two
 * connections that share one source but diverge to different targets would otherwise both anchor
 * at the same point right below their shared source; blending partway toward each one's own
 * target x pulls them apart along the same axis their paths actually diverge on. */
export const LABEL_X_BLEND_TOWARD_TARGET = 0.5;
/** Gap between the source node's own bottom edge and the label chip's own top edge — small, but
 * enough that the chip never pokes back up into the source it's labelling. */
const LABEL_TOP_MARGIN = 3;
/** Breathing room between a label chip's own bottom edge and the next rank's top edge — small,
 * like every other clearance margin in this module (`layout.ts`'s own `LAYOUT_RANK_SEP` is only
 * 18px). */
const LABEL_BOTTOM_MARGIN = 4;

/**
 * How far below the source node's own bottom edge a direct (unrouted) edge's label *centres* —
 * derived from the chip's own estimated height, not picked by eye: the chip's top edge has to
 * clear the source by `LABEL_TOP_MARGIN`, and a centre is half the chip's own height below its
 * top edge.
 */
export const LABEL_Y_OFFSET_FROM_SOURCE = EDGE_LABEL_CHIP_HEIGHT / 2 + LABEL_TOP_MARGIN;

/**
 * Minimum rank gap (a source's bottom edge to the next rank's top edge) that leaves room for a
 * labelled primary edge's own label chip without it touching the *source* it labels (above) or
 * the next rank's node (below) — derived from `LABEL_Y_OFFSET_FROM_SOURCE` and the chip's own
 * estimated height rather than a constant nudged by eye.
 */
export const MIN_LABELED_RANK_GAP = LABEL_Y_OFFSET_FROM_SOURCE + EDGE_LABEL_CHIP_HEIGHT / 2 + LABEL_BOTTOM_MARGIN;

/** Where a direct (unrouted) edge's label centres, given its source and target nodes — the same
 * anchor `WorkflowEdge.tsx` uses when it has no precomputed `route` (a routed edge carries its
 * own `labelPoint` instead, computed by `edgeRouting.ts`). */
export function computeDirectLabelPoint(source: LayoutNode, target: LayoutNode): Point {
  const sourceX = source.x + source.width / 2;
  const sourceY = source.y + source.height;
  const targetX = target.x + target.width / 2;
  return {
    x: sourceX + (targetX - sourceX) * LABEL_X_BLEND_TOWARD_TARGET,
    y: sourceY + LABEL_Y_OFFSET_FROM_SOURCE,
  };
}

/** The text a connection would actually render as a label (mirrors `WorkflowEdge.tsx`'s own
 * `showLabel` check: `label`, falling back to `condition`, and only when non-blank). */
export function connectionLabelText(connection: { label?: string | undefined; condition?: string | undefined }): string | undefined {
  const text = connection.label ?? connection.condition;
  return text !== undefined && text.trim().length > 0 ? text : undefined;
}
