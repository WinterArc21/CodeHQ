import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  topBar: ReactNode;
  /** The workflow navigator (contract §11 `navigator/`), rendered in the left panel. */
  aside: ReactNode;
  children: ReactNode;
}

const RAIL_MARKERS = ["01", "02", "03", "04"];

/**
 * The application frame: a slim decorative rail, a top bar, and a two-column body (navigator +
 * main content). Collapses the rail below 1024px so the navigator and main content keep their
 * room; never introduces horizontal page scroll.
 */
export function AppShell({ topBar, aside, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <nav className={styles.rail} aria-hidden="true">
        {RAIL_MARKERS.map((marker) => (
          <span key={marker} className={styles.railMarker}>
            {marker}
          </span>
        ))}
      </nav>
      <div className={styles.frame}>
        <header className={styles.top}>{topBar}</header>
        <div className={styles.body}>
          <aside className={styles.aside}>{aside}</aside>
          <main className={styles.main}>{children}</main>
        </div>
      </div>
    </div>
  );
}
