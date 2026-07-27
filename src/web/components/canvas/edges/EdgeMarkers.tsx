import styles from "./EdgeMarkers.module.css";

const MARKER_VARIANTS = ["success", "failure", "conditional", "async"] as const;
type MarkerVariant = (typeof MARKER_VARIANTS)[number];

const MARKER_CLASS_NAMES: Record<MarkerVariant, string | undefined> = {
  success: styles.markerSuccess,
  failure: styles.markerFailure,
  conditional: styles.markerConditional,
  async: styles.markerAsync,
};

/** The SVG marker id for a connection `type` (`undefined` maps to the `"success"` marker). */
export function edgeMarkerId(type: MarkerVariant | undefined): string {
  return `observatory-arrow-${type ?? "success"}`;
}

/**
 * One arrowhead `<marker>` per connection type/colour, defined once and shared by every edge via
 * `markerEnd="url(#observatory-arrow-<type>)"`. Coloured entirely through CSS classes that
 * reference `--accent-*` tokens (never a literal colour), matching `connectionStyle` (contract
 * §10's connection-type table).
 */
export function EdgeMarkers() {
  return (
    <svg className={styles.defs} aria-hidden="true">
      <defs>
        {MARKER_VARIANTS.map((variant) => (
          <marker
            key={variant}
            id={edgeMarkerId(variant)}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className={MARKER_CLASS_NAMES[variant]} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
