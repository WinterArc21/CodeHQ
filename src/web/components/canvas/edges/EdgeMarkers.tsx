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
  return `observatory-arrow-${type ?? "success"}`;
}

/**
 * One arrowhead `<marker>` per connection type/colour, defined once and shared by every edge via
 * `markerEnd="url(#observatory-arrow-<type>)"`. Coloured entirely through CSS classes that
 * reference `--accent-*` tokens (never a literal colour), matching `connectionStyle` (contract
 * §10's connection-type table).
 *
 * Deliberately small and narrow (a 7x7 viewBox drawn to a 6x6 rendered size, versus the previous
 * 10x10 drawn to 7x7): a big triangular arrowhead reads as heavy machinery on a canvas whose
 * lines are themselves only 1.25-2px — direction should be unmistakable without becoming the most
 * visually dominant part of the edge (explicit product feedback: "current arrowheads are too
 * big").
 */
export function EdgeMarkers() {
  return (
    <svg className={styles.defs} aria-hidden="true">
      <defs>
        {MARKER_VARIANTS.map((variant) => (
          <marker
            key={variant}
            id={edgeMarkerId(variant)}
            viewBox="0 0 7 7"
            refX="5.5"
            refY="3.5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L7,3.5 L0,7 z" className={MARKER_CLASS_NAMES[variant]} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
