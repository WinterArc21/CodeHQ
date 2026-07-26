import type { ReactNode } from "react";
import styles from "./Panel.module.css";

export interface PanelProps {
  header?: ReactNode;
  children: ReactNode;
}

export function Panel({ header, children }: PanelProps) {
  return (
    <section className={styles.panel}>
      {header !== undefined ? <div className={styles.header}>{header}</div> : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
