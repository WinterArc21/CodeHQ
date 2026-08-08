import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { WorkflowRecord } from "../../api/types";
import { SectionLabel } from "../primitives";
import { WorkflowListItem } from "./WorkflowListItem";
import styles from "./WorkflowNavigator.module.css";

export interface WorkflowNavigatorProps {
  workflows: WorkflowRecord[];
  selectedWorkflowId: string | null;
  onSelect: (workflowId: string) => void;
  /** Controlled by App for the shell grid; omitted for a self-contained navigator. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * A plain, fully-tabbable button list (Tab/Shift+Tab + Enter/Space work natively) with an
 * Up/Down arrow-key convenience layered on top via DOM focus movement — deliberately not an
 * ARIA `listbox`, since a partial listbox implementation is worse than a correct plain list
 * (contract §11).
 */
export function WorkflowNavigator({
  workflows,
  selectedWorkflowId,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: WorkflowNavigatorProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false);
  const isCollapsed = collapsed ?? uncontrolledCollapsed;

  const handleToggleCollapsed = (): void => {
    if (onToggleCollapsed !== undefined) {
      onToggleCollapsed();
      return;
    }
    setUncontrolledCollapsed((current) => !current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-workflow-item]") ?? []);
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    if (currentIndex === -1) {
      return;
    }
    event.preventDefault();
    const nextIndex = event.key === "ArrowDown" ? Math.min(currentIndex + 1, buttons.length - 1) : Math.max(currentIndex - 1, 0);
    buttons[nextIndex]?.focus();
  };

  return (
    <nav className={`${styles.navigator} ${isCollapsed ? styles.collapsed : ""}`} aria-label="Workflows">
      <div className={styles.header}>
        {isCollapsed ? null : <SectionLabel as="h2">Workflows</SectionLabel>}
        <button
          type="button"
          className={styles.toggle}
          aria-controls={listId}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand workflows rail" : "Collapse workflows rail"}
          title={isCollapsed ? "Expand workflows rail" : "Collapse workflows rail"}
          onClick={handleToggleCollapsed}
        >
          {isCollapsed ? <CaretRight size={16} weight="bold" aria-hidden="true" /> : <CaretLeft size={16} weight="bold" aria-hidden="true" />}
        </button>
      </div>
      <div id={listId} className={styles.content} hidden={isCollapsed}>
        {workflows.length === 0 ? (
          <p className={styles.empty}>No workflows yet.</p>
        ) : (
          <ul className={styles.list} ref={listRef} onKeyDown={handleKeyDown}>
            {workflows.map((record) => (
              <WorkflowListItem
                key={record.id}
                record={record}
                selected={record.id === selectedWorkflowId}
                onSelect={() => onSelect(record.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
