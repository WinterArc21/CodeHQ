import type { ElementType, ReactNode } from "react";
import styles from "./SectionLabel.module.css";

export interface SectionLabelProps {
  children: ReactNode;
  /** Which element to render as; defaults to a non-semantic `span` for inline micro-labels. */
  as?: ElementType;
}

export function SectionLabel({ children, as: Component = "span" }: SectionLabelProps) {
  return <Component className={styles.label}>{children}</Component>;
}
