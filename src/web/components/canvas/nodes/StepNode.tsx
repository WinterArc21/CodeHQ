import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { categoryToken, confidenceStyle } from "../../../design/semantics";
import { Badge, IconButton } from "../../primitives";
import { stepCounts } from "../nodeContent";
import type { StepFlowNode } from "../types";
import { StepNodeDetail } from "./StepNodeDetail";
import styles from "./StepNode.module.css";

/**
 * The single, most important visual component in the product (contract §10). A collapsed node
 * shows only index/name/purpose/category/confidence/counts; `StepNodeDetail` adds the
 * files/symbols sections as depth increases. The card itself is the roving-tabindex target
 * (`data-step-node`, `tabIndex`, `onKeyDown` all come from `useCanvasKeyboardNav` via node data)
 * — never measured, its box is exactly the size `layout.ts` computed for it.
 */
export function StepNode({ data }: NodeProps<StepFlowNode>) {
  const { step, index, effectiveDepth, expanded, selected, hasMissingSource, tabIndex, onToggleExpand, onKeyDown } = data;
  const category = categoryToken(step.category);
  const confidence = confidenceStyle(step.confidence);
  const counts = stepCounts(step);
  const hasCounts = counts.sources > 0 || counts.edgeCases > 0 || counts.tests > 0;

  const cardClassName = selected ? `${styles.card} ${styles.selected}` : styles.card;
  const accessibleName = `${index + 1}. ${step.name}. ${category.label} category. ${confidence.label} confidence.${
    hasMissingSource ? " Missing sources." : ""
  }`;

  return (
    <div
      className={cardClassName}
      style={{ borderLeftColor: `var(${category.varName})` }}
      data-step-node={step.id}
      role="button"
      tabIndex={tabIndex}
      aria-label={accessibleName}
      aria-current={selected ? "true" : undefined}
      onKeyDown={onKeyDown}
    >
      {/* Invisible anchors React Flow needs to compute where an edge attaches (contract: no
          interaction that requires precision dragging — connecting isn't offered, so these are
          purely geometric, never shown or draggable). Matches the LR layout: in on the left,
          out on the right. */}
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />

      <div className={styles.header}>
        <span className={styles.index} aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={styles.name}>{step.name}</span>
        {selected ? <Check size={14} weight="bold" className={styles.selectedIcon} aria-hidden="true" /> : null}
        {hasMissingSource ? <Badge tone="red">Missing sources</Badge> : null}
      </div>

      <p className={styles.purpose}>{step.purpose}</p>

      <div className={styles.meta}>
        <span className={styles.categoryLabel} style={{ color: `var(${category.varName})` }}>
          {category.label}
        </span>
        <Badge tone="neutral" dashed={confidence.marker === "dashed"} dot={confidence.marker === "solid-dot"}>
          {confidence.label}
        </Badge>
      </div>

      {hasCounts ? (
        <div className={styles.counts}>
          {counts.sources > 0 ? <span>{counts.sources} sources</span> : null}
          {counts.edgeCases > 0 ? <span>{counts.edgeCases} edge cases</span> : null}
          {counts.tests > 0 ? <span>{counts.tests} tests</span> : null}
        </div>
      ) : null}

      <StepNodeDetail step={step} depth={effectiveDepth} />

      <div className={styles.expandRow}>
        <IconButton
          label={expanded ? `Collapse ${step.name}` : `Expand ${step.name} to show file and symbol details`}
          icon={expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
          size="sm"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
        />
      </div>
    </div>
  );
}
