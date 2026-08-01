import { Moon, Sun } from "@phosphor-icons/react";
import { IconButton } from "../components/primitives";
import type { Theme } from "../store/useObservatoryStore";
import styles from "./ExportBanner.module.css";

export interface ExportBannerProps {
  workflowName: string;
  exportedAt: string;
  repositoryName: string;
  hideFilePaths: boolean;
  onToggleHideFilePaths: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * The thin top bar of an exported snapshot: identifies the file as a Code Observatory export,
 * shows the workflow name and generation timestamp, displays the privacy notice, and provides
 * the "Hide file paths" toggle and theme switcher — the two interactive controls the snapshot
 * itself offers beyond the canvas.
 */
export function ExportBanner({
  workflowName,
  exportedAt,
  repositoryName,
  hideFilePaths,
  onToggleHideFilePaths,
  theme,
  onToggleTheme,
}: ExportBannerProps) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <div className={styles.banner}>
      <div className={styles.identity}>
        <div className={styles.titleRow}>
          <span className={styles.badge}>Code Observatory Export</span>
          <span className={styles.name}>{workflowName}</span>
        </div>
        <span className={styles.timestamp}>{repositoryName} · {formatTimestamp(exportedAt)}</span>
      </div>
      <p className={styles.notice}>
        Snapshot of the agent-authored workflow description and relative file paths — not source code.
      </p>
      <div className={styles.actions}>
        <label className={`${styles.toggle} ${hideFilePaths ? styles.toggleActive : ""}`}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={hideFilePaths}
            onChange={onToggleHideFilePaths}
          />
          Hide file paths in view
        </label>
        <IconButton
          label={`Switch to ${nextTheme} theme`}
          icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          onClick={onToggleTheme}
        />
      </div>
    </div>
  );
}
