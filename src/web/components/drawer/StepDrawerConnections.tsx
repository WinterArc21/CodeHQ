import type { Workflow, WorkflowConnection } from "@schema/workflow";
import { ConnectionRow } from "./ConnectionRow";
import { stepNameById } from "./connectionLookup";
import { DrawerSection } from "./DrawerSection";
import styles from "./StepDrawer.module.css";

export interface StepDrawerConnectionsProps {
  workflow: Workflow;
  incoming: WorkflowConnection[];
  outgoing: WorkflowConnection[];
  onSelectStep: (stepId: string) => void;
}

function connectionKey(connection: WorkflowConnection): string {
  return connection.id ?? `${connection.from}-${connection.to}-${connection.type ?? "success"}`;
}

/** Incoming/outgoing connections (contract §11 point 12) — omitted entirely by the caller when
 * the step has neither. Clicking a row selects the connected step so the drawer content updates
 * in place, letting the user walk the workflow without returning to the canvas. */
export function StepDrawerConnections({ workflow, incoming, outgoing, onSelectStep }: StepDrawerConnectionsProps) {
  if (incoming.length === 0 && outgoing.length === 0) {
    return null;
  }

  return (
    <DrawerSection title="Connections">
      {outgoing.length > 0 ? (
        <div>
          <p className={styles.subLabel}>Outgoing</p>
          <ul className={styles.list}>
            {outgoing.map((connection) => (
              <li key={connectionKey(connection)}>
                <ConnectionRow
                  direction="out"
                  connection={connection}
                  stepName={stepNameById(workflow, connection.to)}
                  onSelect={() => onSelectStep(connection.to)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {incoming.length > 0 ? (
        <div>
          <p className={styles.subLabel}>Incoming</p>
          <ul className={styles.list}>
            {incoming.map((connection) => (
              <li key={connectionKey(connection)}>
                <ConnectionRow
                  direction="in"
                  connection={connection}
                  stepName={stepNameById(workflow, connection.from)}
                  onSelect={() => onSelectStep(connection.from)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DrawerSection>
  );
}
