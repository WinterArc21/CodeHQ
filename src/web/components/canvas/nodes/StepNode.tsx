import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { categoryToken, confidenceStyle } from "../../../design/semantics";
import { Badge, IconButton } from "../../primitives";
import { formatCountsSummary, formatDataReferenceNames, purposeLineCount, stepCounts, stepIoSummary } from "../nodeContent";
import type { StepFlowNode } from "../types";
import { StepNodeDetail } from "./StepNodeDetail";
import styles from "./StepNode.module.css";

/**
 * The single, most important visual component in the product (contract §10). A collapsed node
 * shows index/name/purpose/category/confidence/counts/inputs-outputs; `StepNodeDetail` adds the
 * files/symbols sections as depth increases. The card itself is the roving-tabindex target
 * (`data-step-node`, `tabIndex`, `onKeyDown` all come from `useCanvasKeyboardNav` via node data)
 * — never measured, its box is exactly the size `layout.ts` computed for it.
 */
export function StepNode({ data }: NodeProps<StepFlowNode>) {
  const { step, index, effectiveDepth, expanded, selected, hasMissingSource, tabIndex, onToggleExpand, onKeyDown } = data;
  const category = categoryToken(step.category);
  const confidence = confidenceStyle(step.confidence);
  const counts = stepCounts(step);
  const io = stepIoSummary(step);
  const countsSummary = formatCountsSummary(counts);
  const inSummary = formatDataReferenceNames(io.inputs);
  const outSummary = formatDataReferenceNames(io.outputs);
  const hasFacts = countsSummary.length > 0 || inSummary.length > 0 || outSummary.length > 0;

  const cardClassName = selected ? `${styles.card} ${styles.selected}` : styles.card;
  const markerClassName = confidence.marker === "dashed" ? `${styles.marker} ${styles.markerDashed}` : styles.marker;
  const purposeClassName =
    purposeLineCount(step.purpose) === 2 ? `${styles.purpose} ${styles.purposeTwoLine}` : styles.purpose;
  const accessibleName = `${index + 1}. ${step.name}. ${category.label} category. ${confidence.label} confidence.${
    hasMissingSource ? " Missing sources." : ""
  }`;

  return (
    <div
      className={cardClassName}
      data-step-node={step.id}
      role="button"
      tabIndex={tabIndex}
      aria-label={accessibleName}
      aria-current={selected ? "true" : undefined}
      onKeyDown={onKeyDown}
    >
      {/* Invisible anchors React Flow needs to compute where an edge attaches (contract: no
          interaction that requires precision dragging — connecting isn't offered, so these are
          purely geometric, never shown or draggable). Matches the top-to-bottom layout: in on
          top, out on the bottom. */}
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <Handle type="source" position={Position.Bottom} className={styles.handle} />

      {/* The category+confidence marker (contract §10): colour always encodes category, never
          confidence, so confidence is layered on as a *shape* difference (solid vs dashed
          stripes) instead of a second colour — "never colour alone" holds for this signal too. */}
      <span className={markerClassName} style={{ color: `var(${category.varName})` }} aria-hidden="true" />

      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.index} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className={styles.name}>{step.name}</span>
          {selected ? <Check size={14} weight="bold" className={styles.selectedIcon} aria-hidden="true" /> : null}
          {hasMissingSource ? <Badge tone="red">Missing sources</Badge> : null}
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

        <p className={purposeClassName}>{step.purpose}</p>

        <div className={styles.meta}>
          <span className={styles.categoryLabel} style={{ color: `var(${category.varName})` }}>
            {category.label}
          </span>
          <Badge tone="neutral" dashed={confidence.marker === "dashed"} dot={confidence.marker === "solid-dot"}>
            {confidence.label}
          </Badge>
        </div>

        {hasFacts ? (
          <div className={styles.facts}>
            {countsSummary.length > 0 ? (
              <span className={styles.factsCounts} title={countsSummary}>
                {countsSummary}
              </span>
            ) : null}
            <span className={styles.factsIo}>
              {inSummary.length > 0 ? (
                <span className={styles.ioTag} title={`Input: ${inSummary}`}>
                  <span className={styles.ioLabel}>in</span>
                  <span className={styles.ioValue}>{inSummary}</span>
                </span>
              ) : null}
              {outSummary.length > 0 ? (
                <span className={styles.ioTag} title={`Output: ${outSummary}`}>
                  <span className={styles.ioLabel}>out</span>
                  <span className={styles.ioValue}>{outSummary}</span>
                </span>
              ) : null}
            </span>
          </div>
        ) : null}

        <StepNodeDetail step={step} depth={effectiveDepth} />
      </div>
    </div>
  );
}
