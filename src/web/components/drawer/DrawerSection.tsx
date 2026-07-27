import type { ReactNode } from "react";
import { SectionLabel } from "../primitives";
import styles from "./DrawerSection.module.css";

export interface DrawerSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * One section of the step drawer. Callers only render this when the underlying data actually
 * exists — there is deliberately no "empty" state here, because contract requires omitting a
 * section entirely rather than showing an empty heading.
 */
export function DrawerSection({ title, children }: DrawerSectionProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <SectionLabel as="h3">{title}</SectionLabel>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
