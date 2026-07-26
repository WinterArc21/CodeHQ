/**
 * Opens the OS file manager at a known, server-computed path. Never accepts an arbitrary
 * path from a request body — callers pass one of the two closed targets from `/api/reveal`
 * and this module maps that to an absolute path itself.
 */

import { spawn } from "node:child_process";
import path from "node:path";

export type RevealImpl = (absolutePath: string) => Promise<void>;

interface RevealCommand {
  command: string;
  args: string[];
}

export function buildRevealCommand(absolutePath: string, platform: NodeJS.Platform = process.platform): RevealCommand {
  switch (platform) {
    case "win32":
      return { command: "explorer.exe", args: [`/select,${absolutePath}`] };
    case "darwin":
      return { command: "open", args: ["-R", absolutePath] };
    default:
      return { command: "xdg-open", args: [path.dirname(absolutePath)] };
  }
}

/**
 * Spawns the platform file manager with an argument array (never a shell string, never
 * `shell: true`) so nothing here can be turned into shell injection.
 */
export const defaultRevealImpl: RevealImpl = (absolutePath) =>
  new Promise((resolve, reject) => {
    const { command, args } = buildRevealCommand(absolutePath);
    const child = spawn(command, args, { shell: false });

    child.once("error", (error) => {
      reject(error);
    });
    child.once("exit", (code) => {
      // explorer.exe on Windows routinely exits non-zero even after successfully revealing
      // the file; only `open`/`xdg-open` exit codes are trustworthy failure signals.
      if (process.platform === "win32" || code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Reveal command '${command}' exited with code ${code}.`));
      }
    });
  });
