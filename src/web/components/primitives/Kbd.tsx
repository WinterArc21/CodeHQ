import type { ReactNode } from "react";
import styles from "./Kbd.module.css";

export interface KbdProps {
  children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
