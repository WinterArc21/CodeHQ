import { DrawerSection } from "./DrawerSection";
import styles from "./StepDrawer.module.css";

export interface StepDrawerNotesProps {
  implementation?: string;
  decisions: string[];
  assumptions: string[];
}

/** Implementation notes + important decisions/assumptions (contract §11 points 10–11). */
export function StepDrawerNotes({ implementation, decisions, assumptions }: StepDrawerNotesProps) {
  const hasDecisions = decisions.length > 0 || assumptions.length > 0;

  return (
    <>
      {implementation !== undefined ? (
        <DrawerSection title="Implementation">
          <p className={styles.note}>{implementation}</p>
        </DrawerSection>
      ) : null}

      {hasDecisions ? (
        <DrawerSection title="Decisions & assumptions">
          {decisions.length > 0 ? (
            <div>
              <p className={styles.subLabel}>Decisions</p>
              <ul className={styles.bulletList}>
                {decisions.map((decision, index) => (
                  <li key={index}>{decision}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {assumptions.length > 0 ? (
            <div>
              <p className={styles.subLabel}>Assumptions</p>
              <ul className={styles.bulletList}>
                {assumptions.map((assumption, index) => (
                  <li key={index}>{assumption}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </DrawerSection>
      ) : null}
    </>
  );
}
