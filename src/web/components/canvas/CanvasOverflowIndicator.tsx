import { CaretDown } from "@phosphor-icons/react";
import styles from "./WorkflowCanvas.module.css";

/**
 * A quiet "more below" affordance (contract mandate: a user must never believe they're seeing
 * the whole graph when they aren't). `WorkflowCanvas` renders this only when `fitViewport.ts`
 * reports the fitted graph's bottom edge still falls below the visible stage — a deeper depth
 * (`modules`/`symbols` grow every node) or a large workflow can be taller than even the minimum
 * legible zoom allows. Purely decorative: panning/scrolling already works, this only says it's
 * worth doing.
 */
export function CanvasOverflowIndicator() {
  return (
    <div className={styles.overflowFade} aria-hidden="true">
      <span className={styles.overflowLabel}>
        <CaretDown size={11} weight="bold" />
        More below
      </span>
    </div>
  );
}
