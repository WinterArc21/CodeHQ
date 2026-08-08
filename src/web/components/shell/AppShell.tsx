import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  topBar: ReactNode;
  /** The workflow navigator (contract §11 `navigator/`), rendered in the left panel. */
  aside: ReactNode;
  /** Transient chrome state; intentionally not persisted with workflow or UI preferences. */
  asideCollapsed?: boolean;
  children: ReactNode;
}

/**
 * The application frame: a top bar and a two-column body (navigator + main content). Never
 * introduces horizontal page scroll.
 */
export function AppShell({ topBar, aside, asideCollapsed = false, children }: AppShellProps) {
  return (
    <div className={styles.frame}>
      <header className={styles.top}>{topBar}</header>
      <div
        className={`${styles.body} ${asideCollapsed ? styles.bodyCollapsed : ""}`}
        data-aside-collapsed={asideCollapsed ? "true" : "false"}
      >
        <aside className={styles.aside}>{aside}</aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
