import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveInsideRepository } from "@core/safe-path";

let root: string;
let siblingDir: string;
let canSymlink = false;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hq-safe-path-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, "a", "b"), { recursive: true });
  writeFileSync(path.join(root, "src", "index.ts"), "export {};\n");
  writeFileSync(path.join(root, "a", "b", "c.ts"), "export {};\n");

  // A sibling directory whose name shares a prefix with `root` — the classic
  // `resolved.startsWith(root)` bug would treat `<root>-evil` as "inside" `root`.
  siblingDir = `${root}-evil`;
  mkdirSync(siblingDir, { recursive: true });
  writeFileSync(path.join(siblingDir, "secret.ts"), "export {};\n");

  try {
    symlinkSync(siblingDir, path.join(root, "escape-link"), "dir");
    canSymlink = true;
  } catch {
    canSymlink = false;
  }
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(siblingDir, { recursive: true, force: true });
});

describe("resolveInsideRepository — rejects unsafe input", () => {
  it("rejects a path with a '..' segment", () => {
    expect(resolveInsideRepository(root, "../etc/passwd").ok).toBe(false);
  });

  it("rejects a backslash '..' traversal", () => {
    expect(resolveInsideRepository(root, "..\\..\\x").ok).toBe(false);
  });

  it("rejects a leading-slash absolute path", () => {
    expect(resolveInsideRepository(root, "/abs/path").ok).toBe(false);
  });

  it("rejects a Windows drive-letter path", () => {
    expect(resolveInsideRepository(root, "C:\\Windows\\x").ok).toBe(false);
  });

  it("rejects a UNC path", () => {
    expect(resolveInsideRepository(root, "\\\\server\\share").ok).toBe(false);
  });

  it("rejects a '..' segment buried in the middle of the path", () => {
    expect(resolveInsideRepository(root, "foo/../../bar").ok).toBe(false);
  });

  it("rejects an empty path", () => {
    expect(resolveInsideRepository(root, "").ok).toBe(false);
  });

  it("rejects a path containing a NUL byte", () => {
    expect(resolveInsideRepository(root, "foo\0bar.ts").ok).toBe(false);
  });

  it("never uses a bare prefix check: a sibling directory sharing a name prefix is not 'inside'", () => {
    // Even though describePathProblem already rejects any literal ".." segment, this
    // guards the containment check itself: `resolved.startsWith(root)` alone (without a
    // trailing separator) would wrongly accept "<root>-evil/...".
    const result = resolveInsideRepository(root, "sibling-check.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.absolutePath.startsWith(siblingDir)).toBe(false);
    }
  });

  it.skipIf(!canSymlink)("rejects a symlinked directory that escapes the repository root", () => {
    const result = resolveInsideRepository(root, "escape-link/secret.ts");
    expect(result.ok).toBe(false);
  });
});

describe("resolveInsideRepository — accepts legitimate nested paths", () => {
  it("accepts an existing nested file", () => {
    const result = resolveInsideRepository(root, "src/index.ts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(path.basename(result.absolutePath)).toBe("index.ts");
    }
  });

  it("accepts a deeper existing nested file", () => {
    const result = resolveInsideRepository(root, "a/b/c.ts");
    expect(result.ok).toBe(true);
  });

  it("accepts a nested path that does not exist yet, as long as its parent does", () => {
    const result = resolveInsideRepository(root, "src/not-created-yet.ts");
    expect(result.ok).toBe(true);
  });

  it("accepts backslash-separated relative paths", () => {
    const result = resolveInsideRepository(root, "a\\b\\c.ts");
    expect(result.ok).toBe(true);
  });

  it("accepts the root itself via '.'", () => {
    const result = resolveInsideRepository(root, ".");
    expect(result.ok).toBe(true);
  });
});
