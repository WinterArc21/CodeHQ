import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const schemaAlias = fileURLToPath(new URL("./src/schema", import.meta.url));
const coreAlias = fileURLToPath(new URL("./src/core", import.meta.url));
const serverAlias = fileURLToPath(new URL("./src/server", import.meta.url));
const webAlias = fileURLToPath(new URL("./src/web", import.meta.url));

const WEB_TEST_GLOBS = ["tests/unit/web/**/*.test.ts", "tests/unit/web/**/*.test.tsx", "**/*.web.test.ts", "**/*.web.test.tsx"];

export default defineConfig({
  resolve: {
    alias: {
      "@schema": schemaAlias,
      "@core": coreAlias,
      "@server": serverAlias,
      "@web": webAlias,
    },
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    // Split by environment: schema/core/server/cli tests run under plain Node, anything
    // under tests/unit/web (or named *.web.test.ts[x]) runs under jsdom for DOM access.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
          exclude: [...WEB_TEST_GLOBS, "tests/e2e/**", "node_modules/**", "dist/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: WEB_TEST_GLOBS,
          exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
        },
      },
    ],
  },
});
