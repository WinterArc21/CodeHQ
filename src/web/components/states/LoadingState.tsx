import styles from "./LoadingState.module.css";

/** A calm, non-shimmering loading state — a single slow pulse, frozen under reduced motion. */
export function LoadingState() {
  return (
    <div className={styles.layout} role="status" aria-live="polite">
      <span className={styles.pulse} aria-hidden="true" />
      <p className={styles.label}>Loading Code Observatory…</p>
    </div>
  );
}
