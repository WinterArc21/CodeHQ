import { FolderOpen, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { reveal } from "../../api/client";
import { searchShortcutLabel } from "../../lib/platform";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { Badge, IconButton, Kbd } from "../primitives";
import { CopyAgentPrompt } from "./CopyAgentPrompt";
import { LocalOnlyBadge } from "./LocalOnlyBadge";
import { StatusIndicator, type ObservatoryStatus } from "./StatusIndicator";
import styles from "./TopBar.module.css";
import { ThemeToggle } from "./ThemeToggle";

export interface TopBarProps {
  repositoryName: string;
  /** The `ObservatoryProject.schemaVersion`, shown as a small `main`-branch-style chip. */
  schemaVersion?: string;
  status: ObservatoryStatus;
  errorCount?: number;
  onOpenSearch: () => void;
}

export function TopBar({ repositoryName, schemaVersion, status, errorCount, onOpenSearch }: TopBarProps) {
  const revealAction = useAsyncAction(() => reveal("observatory"));

  return (
    <div>
      <div className={styles.bar}>
        <div className={styles.left}>
          <span className={styles.repoName}>{repositoryName}</span>
          {schemaVersion !== undefined ? <Badge tone="neutral">schema v{schemaVersion}</Badge> : null}
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
          <IconButton label="Reveal .observatory in file manager" icon={<FolderOpen size={16} />} onClick={revealAction.run} />
          <ThemeToggle />
        </div>
      </div>
      {revealAction.status === "error" && revealAction.message !== null ? (
        <div className={styles.errorBanner} role="alert">
          <span>
            <WarningCircle size={14} aria-hidden="true" /> {revealAction.message}
          </span>
          <IconButton label="Dismiss" icon={<span aria-hidden="true">×</span>} size="sm" onClick={revealAction.reset} />
        </div>
      ) : null}
    </div>
  );
}
