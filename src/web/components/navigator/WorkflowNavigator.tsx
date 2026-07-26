import { useRef, type KeyboardEvent } from "react";
import type { WorkflowRecord } from "../../api/types";
import { SectionLabel } from "../primitives";
import { WorkflowListItem } from "./WorkflowListItem";
import styles from "./WorkflowNavigator.module.css";

export interface WorkflowNavigatorProps {
  workflows: WorkflowRecord[];
  selectedWorkflowId: string | null;
  onSelect: (workflowId: string) => void;
}

/**
 * A plain, fully-tabbable button list (Tab/Shift+Tab + Enter/Space work natively) with an
 * Up/Down arrow-key convenience layered on top via DOM focus movement — deliberately not an
 * ARIA `listbox`, since a partial listbox implementation is worse than a correct plain list
 * (contract §11).
 */
export function WorkflowNavigator({ workflows, selectedWorkflowId, onSelect }: WorkflowNavigatorProps) {
  const listRef = useRef<HTMLUListElement>(null);

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
    <nav className={styles.navigator} aria-label="Workflows">
      <div className={styles.header}>
        <SectionLabel as="h2">Workflows</SectionLabel>
      </div>
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
    </nav>
  );
}
