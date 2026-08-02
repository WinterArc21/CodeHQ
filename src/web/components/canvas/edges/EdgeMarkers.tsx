import styles from "./EdgeMarkers.module.css";

const MARKER_VARIANTS = ["success", "failure", "conditional", "async", "retry"] as const;
type MarkerVariant = (typeof MARKER_VARIANTS)[number];

const MARKER_CLASS_NAMES: Record<MarkerVariant, string | undefined> = {
  success: styles.markerSuccess,
  failure: styles.markerFailure,
  conditional: styles.markerConditional,
  async: styles.markerAsync,
  retry: styles.markerRetry,
};

/** The SVG marker id for a connection `type` (`undefined` maps to the `"success"` marker). */
export function edgeMarkerId(type: MarkerVariant | undefined): string {
  return `codehq-arrow-${type ?? "success"}`;
}

/**
 * One arrowhead `<marker>` per connection type/colour, defined once and shared by every edge via
 * `markerEnd="url(#codehq-arrow-<type>)"`. Coloured entirely through CSS classes that
 * reference `--accent-*` tokens (never a literal colour), matching `connectionStyle` (contract
 * §10's connection-type table).
 *
 * Deliberately compact: `markerUnits="userSpaceOnUse"` makes the 7x7 dimensions real canvas
 * units instead of SVG's default stroke-width multiples (which inflated these to roughly
 * 16-20px on the strengthened edges). Every connection type now gets the same quiet directional
 * cue without a large triangle competing with its line or destination node.
 */
export function EdgeMarkers() {
  return (
    <svg className={styles.defs} aria-hidden="true">
      <defs>
        {MARKER_VARIANTS.map((variant) => (
          <marker
            key={variant}
            id={edgeMarkerId(variant)}
            viewBox="0 0 9 9"
            refX="7.5"
            refY="4.5"
            markerWidth="7"
            markerHeight="7"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L9,4.5 L0,9 z" className={MARKER_CLASS_NAMES[variant]} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
