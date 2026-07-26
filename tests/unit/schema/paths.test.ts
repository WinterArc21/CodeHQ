import { describe, expect, it } from "vitest";
import { describePathProblem, isRepositoryRelativePath } from "@schema/paths";

describe("isRepositoryRelativePath", () => {
  const acceptedPaths = [
    "src/index.ts",
    "src\\index.ts",
    "a/b/c.ts",
    "a\\b\\c.ts",
    "file.ts",
    "./src/index.ts",
    "a.b/c-d_e.ts",
    "src/components/Button.module.css",
  ];

  it.each(acceptedPaths)("accepts %s", (path) => {
    expect(isRepositoryRelativePath(path)).toBe(true);
    expect(describePathProblem(path)).toBeNull();
  });

  const rejectedPaths = [
    { label: "empty string", path: "" },
    { label: "absolute POSIX path", path: "/etc/passwd" },
    { label: "windows drive letter, backslash", path: "C:\\Users\\me\\file.ts" },
    { label: "windows drive letter, forward slash", path: "c:/Users/me/file.ts" },
    { label: "UNC network path", path: "\\\\server\\share\\file.ts" },
    { label: "leading backslash", path: "\\file.ts" },
    { label: "parent traversal at start", path: "../secret.ts" },
    { label: "parent traversal in the middle", path: "src/../../etc/passwd" },
    { label: "parent traversal at end", path: "src/.." },
    { label: "bare parent traversal", path: ".." },
    { label: "NUL byte", path: "src/inde\0x.ts" },
  ];

  it.each(rejectedPaths)("rejects $label", ({ path }) => {
    expect(isRepositoryRelativePath(path)).toBe(false);
    expect(describePathProblem(path)).not.toBeNull();
  });

  it("does not reject a path merely because a segment contains '..' as a substring", () => {
    expect(isRepositoryRelativePath("src/foo..bar.ts")).toBe(true);
  });
});
