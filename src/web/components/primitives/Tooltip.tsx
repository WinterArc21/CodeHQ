import { cloneElement, useId, type ReactElement } from "react";
import styles from "./Tooltip.module.css";

type Describable = { "aria-describedby"?: string };

export type TooltipPlacement = "above" | "below";

export interface TooltipProps<P extends Describable = Describable> {
  content: string;
  /** Where the bubble sits relative to the trigger. Defaults to `above`. */
  placement?: TooltipPlacement;
  /** A single focusable/hoverable element (button, link, icon button, ...). */
  children: ReactElement<P>;
}

/**
 * Pure CSS/aria-describedby tooltip: no positioning library, no portal. Visibility is driven
 * by `:hover`/`:focus-within` in Tooltip.module.css, so it is reachable via keyboard focus,
 * not only the mouse.
 */
export function Tooltip<P extends Describable>({ content, placement = "above", children }: TooltipProps<P>) {
  const id = useId();
  const describedChild = cloneElement(children, { "aria-describedby": id } as Partial<P>);
  const bubbleClassName = placement === "below" ? `${styles.bubble} ${styles.below}` : styles.bubble;
  return (
    <span className={styles.wrapper}>
      {describedChild}
      <span role="tooltip" id={id} className={bubbleClassName}>
        {content}
      </span>
    </span>
  );
}
