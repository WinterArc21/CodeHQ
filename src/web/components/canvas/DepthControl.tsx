import type { Depth } from "../../store/useObservatoryStore";
import { Tooltip } from "../primitives";
import styles from "./DepthControl.module.css";

export interface DepthControlProps {
  depth: Depth;
  onChange: (depth: Depth) => void;
}

/** Global altitudes exposed in chrome. Internal `symbols` depth remains expand-only. */
export type GlobalDepth = "workflow" | "modules";

const ALTITUDE_HINT = "Story = what happens. Code map = where it lives.";

const DEPTH_OPTIONS: ReadonlyArray<{ value: GlobalDepth; label: string }> = [
  { value: "workflow", label: "Story" },
  { value: "modules", label: "Code map" },
];

/**
 * Two segmented altitudes (contract §11): Story (human workflow) and Code map (files + I/O).
 * Symbol-level detail is available by expanding a single step, not as a third global mode.
 */
export function DepthControl({ depth, onChange }: DepthControlProps) {
  const active: GlobalDepth = depth === "modules" || depth === "symbols" ? "modules" : "workflow";

  return (
    <Tooltip content={ALTITUDE_HINT} placement="below">
      <div className={styles.group} role="group" aria-label="Canvas altitude">
        {DEPTH_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.option} ${active === option.value ? styles.active : ""}`}
            aria-pressed={active === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Tooltip>
  );
}
