import type { ReactNode } from "react";
import type { BadgeTone } from "../../design/semantics";
import styles from "./Badge.module.css";

export interface BadgeProps {
  tone?: BadgeTone;
  /** A small leading dot in the tone colour — used where colour must be paired with a shape. */
  dot?: boolean;
  /** Dashed border, used for `confidence: "inferred"` per contract §10. */
  dashed?: boolean;
  children: ReactNode;
}

export function Badge({ tone = "neutral", dot = false, dashed = false, children }: BadgeProps) {
  const classNames = [styles.badge, styles[tone]];
  if (dashed) {
    classNames.push(styles.dashed);
  }
  return (
    <span className={classNames.join(" ")}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
