import { describe, expect, it } from "vitest";
import { buildRevealCommand } from "@server/reveal";

describe("buildRevealCommand", () => {
  it("uses explorer.exe /select on Windows", () => {
    expect(buildRevealCommand("C:\\repo\\.observatory", "win32")).toEqual({
      command: "explorer.exe",
      args: ["/select,C:\\repo\\.observatory"],
    });
  });

  it("uses open -R on macOS", () => {
    expect(buildRevealCommand("/repo/.observatory", "darwin")).toEqual({
      command: "open",
      args: ["-R", "/repo/.observatory"],
    });
  });

  it("uses xdg-open on the containing directory on Linux", () => {
    expect(buildRevealCommand("/repo/.observatory/SKILL.md", "linux")).toEqual({
      command: "xdg-open",
      args: ["/repo/.observatory"],
    });
  });
});
