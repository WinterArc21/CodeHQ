/**
 * Repository-relative path checking, shared by shape validation (SourceReference.file,
 * TestReference.file) and semantic validation. Pure, isomorphic: no node builtins.
 */

const DRIVE_LETTER_PATTERN = /^[a-zA-Z]:[\\/]/;

/**
 * Returns a human-readable description of what is wrong with `p` as a repository-relative
 * path, or `null` if `p` is acceptable. Accepts both forward-slash and backslash separators.
 */
export function describePathProblem(p: string): string | null {
  if (p.length === 0) {
    return "Path is empty.";
  }
  if (p.includes("\0")) {
    return "Path contains a NUL byte.";
  }
  if (p.startsWith("\\\\")) {
    return "Path is a UNC network path, which is not repository-relative.";
  }
  if (p.startsWith("/") || p.startsWith("\\")) {
    return "Path is absolute, but must be relative to the repository root.";
  }
  if (DRIVE_LETTER_PATTERN.test(p)) {
    return "Path includes a drive letter, but must be relative to the repository root.";
  }
  const segments = p.split(/[\\/]+/);
  if (segments.some((segment) => segment === "..")) {
    return "Path contains a '..' segment, which could escape the repository root.";
  }
  return null;
}

/** True when `p` is a safe, repository-relative path (forward-slash or backslash). */
export function isRepositoryRelativePath(p: string): boolean {
  return describePathProblem(p) === null;
}
