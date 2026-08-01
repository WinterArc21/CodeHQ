import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  topBar: ReactNode;
  /** The workflow navigator (contract §11 `navigator/`), rendered in the left panel. */
  aside: ReactNode;
  children: ReactNode;
}

/**
 * The application frame: a top bar and a two-column body (navigator + main content). Never
 * introduces horizontal page scroll.
 */
export function AppShell({ topBar, aside, children }: AppShellProps) {
  return (
    <div className={styles.frame}>
      <header className={styles.top}>{topBar}</header>
      <div className={styles.body}>
        <aside className={styles.aside}>{aside}</aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
