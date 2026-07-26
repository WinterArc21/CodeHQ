import styles from "./MonoPath.module.css";

export interface MonoPathProps {
  path: string;
  /** Maximum visible characters before middle-truncation kicks in. */
  maxChars?: number;
}

/**
 * Truncates the MIDDLE of a long path, keeping the filename (the last segment) fully visible —
 * the front of the path is far less useful than knowing exactly which file this is.
 */
export function truncateMiddle(path: string, maxChars: number): string {
  if (path.length <= maxChars) {
    return path;
  }
  const segments = path.split(/[\\/]+/);
  const fileName = segments[segments.length - 1] ?? path;
  const ellipsis = "…";

  if (fileName.length + ellipsis.length >= maxChars) {
    // Even the bare filename doesn't fit: keep its tail, which is the most identifying part.
    return `${ellipsis}${fileName.slice(-(maxChars - ellipsis.length))}`;
  }

  const frontBudget = maxChars - fileName.length - ellipsis.length;
  const front = path.slice(0, frontBudget);
  return `${front}${ellipsis}${fileName}`;
}

export function MonoPath({ path, maxChars = 48 }: MonoPathProps) {
  return (
    <span className={styles.path} title={path}>
      {truncateMiddle(path, maxChars)}
    </span>
  );
}
