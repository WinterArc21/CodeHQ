import type { ExternalServiceReference } from "@schema/workflow";
import styles from "./ExternalServiceItem.module.css";

export interface ExternalServiceItemProps {
  service: ExternalServiceReference;
}

/** One row of the External services list (contract §11 point 9). */
export function ExternalServiceItem({ service }: ExternalServiceItemProps) {
  return (
    <li className={styles.row}>
      <span className={styles.name}>{service.name}</span>
      {service.purpose !== undefined ? <p className={styles.purpose}>{service.purpose}</p> : null}
      {service.operation !== undefined ? <span className={styles.operation}>{service.operation}</span> : null}
    </li>
  );
}
