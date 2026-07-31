import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { categoryToken, confidenceStyle } from "../../../design/semantics";
import { Badge, IconButton } from "../../primitives";
import { formatDataReferenceNames, purposeLineCount, stepIoSummary } from "../nodeContent";
import type { StepFlowNode } from "../types";
import { StepNodeDetail } from "./StepNodeDetail";
import styles from "./StepNode.module.css";

/**
 * The single, most important visual component in the product (contract §10). A collapsed node
 * shows index/name/purpose/category/inputs-outputs; `StepNodeDetail` adds the files/symbols
 * sections as depth increases. The card itself is the roving-tabindex target (`data-step-node`,
 * `tabIndex`, `onKeyDown` all come from `useCanvasKeyboardNav` via node data) — never measured,
 * its box is exactly the size `layout.ts` computed for it.
 *
 * Deliberately *not* on the card: the confidence badge and the source/edge-case/test counts. A
 * badge reading "Verified" on almost every step spends a row to say nothing, and a count is a
 * number nobody acts on — the counts now live on the drawer's own section headings, where the
 * full lists they summarise already are. Confidence survives as a shape on the left marker
 * (solid vs striped) and in the card's accessible name, so nothing is lost for a screen reader
 * or for the "which of these did the agent guess at?" question; it just stops shouting.
 */
export function StepNode({ data }: NodeProps<StepFlowNode>) {
  const {
    step,
    index,
    effectiveDepth,
    expanded,
    selected,
    hasMissingSource,
    dimmed,
    tabIndex,
    onToggleExpand,
    onKeyDown,
    onHoverStart,
    onHoverEnd,
    onFocusStep,
    onBlurStep,
  } = data;
  const category = categoryToken(step.category);
  const confidence = confidenceStyle(step.confidence);
  const io = stepIoSummary(step);
  const inSummary = formatDataReferenceNames(io.inputs);
  const outSummary = formatDataReferenceNames(io.outputs);
  const hasFacts = inSummary.length > 0 || outSummary.length > 0;

  const cardClassName = [styles.card, selected ? styles.selected : "", dimmed ? styles.dimmed : ""]
    .filter(Boolean)
    .join(" ");
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
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onFocusStep}
      onBlur={onBlurStep}
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
          {/* Quiet until wanted: the toggle only paints once the card is hovered or holds focus
              (or is already expanded, so the control that undoes that never vanishes out from
              under the pointer). It keeps its box at all times — `opacity`, never `display` — so
              revealing it can't reflow the header, and it stays reachable and hit-testable for
              keyboard and assistive tech regardless of what the mouse is doing. */}
          <span className={`${styles.expandToggle} ${expanded ? styles.expandTogglePinned : ""}`}>
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
          </span>
        </div>

        <p className={purposeClassName}>{step.purpose}</p>

        <div className={styles.meta}>
          <span className={styles.categoryLabel} style={{ color: `var(${category.varName})` }}>
            {category.label}
          </span>
        </div>

        {hasFacts ? (
          <div className={styles.facts}>
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
