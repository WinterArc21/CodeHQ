import type { ReactNode } from "react";
import { SectionLabel } from "../primitives";
import styles from "./DrawerSection.module.css";

export interface DrawerSectionProps {
  title: string;
  /** How many items the section lists. Omit for prose sections, which have nothing to count. */
  count?: number;
  children: ReactNode;
}

/**
 * One section of the step drawer. Callers only render this when the underlying data actually
 * exists — there is deliberately no "empty" state here, because contract requires omitting a
 * section entirely rather than showing an empty heading.
 *
 * `count` is where the collapsed card's old "4 sources · 3 edge cases · 2 tests" row ended up.
 * On the card it was a number with no action attached to it; on the heading of the list it
 * counts, it tells a reader how much is below before they scroll. It stays out of the section's
 * `aria-label` so the accessible name remains the stable string a test or a screen-reader user
 * navigates by, and the list itself already conveys its own length.
 */
export function DrawerSection({ title, count, children }: DrawerSectionProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.head}>
        <SectionLabel as="h3">{title}</SectionLabel>
        {count !== undefined ? (
          <span className={styles.count} aria-hidden="true">
            {count}
          </span>
        ) : null}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
