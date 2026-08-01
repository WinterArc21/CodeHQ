import { MagnifyingGlass } from "@phosphor-icons/react";
import { searchShortcutLabel } from "../../lib/platform";
import { Kbd } from "../primitives";
import { CopyAgentPrompt } from "./CopyAgentPrompt";
import { LocalOnlyBadge } from "./LocalOnlyBadge";
import { StatusIndicator, type HQStatus } from "./StatusIndicator";
import styles from "./TopBar.module.css";
import { ThemeToggle } from "./ThemeToggle";

export interface TopBarProps {
  repositoryName: string;
  status: HQStatus;
  errorCount?: number;
  onOpenSearch: () => void;
}

export function TopBar({ repositoryName, status, errorCount, onOpenSearch }: TopBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.repoName}>{repositoryName}</span>
      </div>

      <div className={styles.center}>
        <LocalOnlyBadge />
      </div>

      <div className={styles.right}>
        <StatusIndicator status={status} {...(errorCount !== undefined ? { errorCount } : {})} />
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={styles.searchTrigger} onClick={onOpenSearch}>
          <MagnifyingGlass size={14} aria-hidden="true" />
          Search
          <Kbd>{searchShortcutLabel()}</Kbd>
        </button>
        <CopyAgentPrompt />
        <ThemeToggle />
      </div>
    </div>
  );
}
