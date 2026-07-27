import { useRef, type PointerEvent as ReactPointerEvent } from "react";

export interface BackdropDismissHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * Click-outside-to-close for a modal backdrop, without the classic bug where selecting text in
 * the dialog (mouse down inside, drag, release outside) is misread as "the user clicked outside."
 * Tracks the element the pointer went *down* on and only closes if both the down and up events
 * landed on the backdrop itself (`target === currentTarget`), never a descendant.
 *
 * Deliberately not a plain `onClick` on the backdrop `<div>`: the backdrop has no keyboard
 * equivalent of its own (Escape already closes the dialog via `useFocusTrap`, which is the real
 * keyboard/AT affordance), so it stays a non-interactive, non-focusable pointer-only surface
 * rather than a fake button with no accessible name.
 */
export function useBackdropDismiss(onDismiss: () => void): BackdropDismissHandlers {
  const pointerDownOnBackdrop = useRef(false);

  return {
    onPointerDown: (event) => {
      pointerDownOnBackdrop.current = event.target === event.currentTarget;
    },
    onPointerUp: (event) => {
      if (pointerDownOnBackdrop.current && event.target === event.currentTarget) {
        onDismiss();
      }
      pointerDownOnBackdrop.current = false;
    },
  };
}
