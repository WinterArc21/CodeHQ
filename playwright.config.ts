import { defineConfig, devices } from "@playwright/test";

// Wave 4 owns the actual fixture repo; this env var lets the e2e suite point the
// CLI's cwd at examples/motiona (or any other fixture) without editing this file.
const fixtureCwd = process.env["OBSERVATORY_E2E_FIXTURE_DIR"] ?? "examples/motiona";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4399",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node dist/node/cli.js open --port 4399 --no-open",
    url: "http://localhost:4399",
    cwd: fixtureCwd,
    reuseExistingServer: !process.env["CI"],
  },
});
