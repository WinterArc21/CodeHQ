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
 * Deliberately compact (a 9x9 viewBox with 8x8 marker dimensions, versus the previous 7x7 with
 * 6x6 dimensions): SVG's default `markerUnits="strokeWidth"` scales the rendered arrowhead with
 * the edge stroke, so primary and traced paths receive proportionately stronger direction cues.
 * The resulting heads stay unmistakable at fit-view zoom without reading as separate heavy
 * glyphs from their 2-2.5px lines.
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
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L9,4.5 L0,9 z" className={MARKER_CLASS_NAMES[variant]} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
