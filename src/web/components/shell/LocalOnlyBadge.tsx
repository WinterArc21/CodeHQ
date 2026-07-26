import styles from "./LocalOnlyBadge.module.css";

/** Restrained, one-line reassurance — not a banner, not colourful. */
export function LocalOnlyBadge() {
  return <p className={styles.badge}>Local repository · No code uploaded · Updated live</p>;
}
