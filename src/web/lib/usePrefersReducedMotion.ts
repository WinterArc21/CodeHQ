import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Tracks the `prefers-reduced-motion` media query for JS-driven animations (contract §11) —
 * CSS transitions already read `--dur-*`, which `tokens.css` zeroes under the same query. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia(QUERY);
    const handleChange = (): void => setReduced(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return reduced;
}
