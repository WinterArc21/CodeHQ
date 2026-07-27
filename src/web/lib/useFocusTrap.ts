import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Traps Tab focus inside `containerRef` for as long as `active` is true, moves focus into it on
 * activation, restores focus to whatever had it beforehand on deactivation, and calls `onClose`
 * on Escape. `onClose` is read through a ref so a new function identity on every render never
 * re-runs the activate/deactivate effect (which would re-capture "previously focused" mid-session
 * and keep stealing focus back to the first field).
 *
 * `active` must be a real dependency of the effect (not just checked inside it): callers such as
 * `CommandPalette` stay mounted at all times so a global keyboard shortcut keeps working, and only
 * flip `active` on and off as the dialog opens and closes. If the effect only re-ran on
 * `containerRef` identity (a ref object never changes identity) it would run exactly once, at
 * first mount, and never again when the dialog later opens — which is the bug this hook exists to
 * avoid regressing.
 *
 * The Escape/Tab listener is attached to `document`, not the container: focus can legitimately
 * leave the container while the dialog is still open (autofocus lands in an input, but clicking a
 * non-focusable row inside the dialog blurs it back to `document.body`), and a container-scoped
 * listener would silently stop handling Escape at that point. The listener is only ever attached
 * while `active` is true, so a closed dialog never intercepts Escape meant for something else.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (focusables()[0] ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused !== null && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
