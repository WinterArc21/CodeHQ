/** True on macOS/iOS, where the search shortcut should read "⌘K" instead of "Ctrl K". */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const source = navigator.platform || navigator.userAgent || "";
  return /Mac|iPhone|iPad|iPod/.test(source);
}

/** The rendered search-shortcut label for the current platform. */
export function searchShortcutLabel(): string {
  return isApplePlatform() ? "⌘K" : "Ctrl K";
}
