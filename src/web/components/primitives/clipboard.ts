/**
 * Clipboard write with a manual-copy fallback. `document.execCommand` is deprecated and
 * unreliable (and unimplemented in jsdom), so it is never used here: when the async Clipboard
 * API is unavailable or denied, the text is selected in a hidden, off-screen textarea so the
 * user can still copy it with their OS shortcut, and the caller is told plainly that automatic
 * copying did not happen rather than being told it succeeded.
 */

export type ClipboardOutcome = "copied" | "manual-selection" | "unavailable";

function selectForManualCopy(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  window.setTimeout(() => {
    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }, 2000);
  return true;
}

export async function copyToClipboard(text: string): Promise<ClipboardOutcome> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return "copied";
    } catch {
      // Permission denied or a transient browser error — fall through to manual selection.
    }
  }
  return selectForManualCopy(text) ? "manual-selection" : "unavailable";
}
