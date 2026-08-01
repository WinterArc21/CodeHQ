/**
 * One-off screenshot capture of Story / Code map / tooltip against the running dev server.
 * Run: pnpm exec tsx scripts/capture-altitude-shots.ts
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "tmp", "altitude-shots");
const BASE = "http://localhost:5173/";

async function main(): Promise<void> {
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator("[data-step-node]").first().waitFor({ state: "visible", timeout: 20_000 });

  // Clear any persisted Code map preference so Story is the starting altitude.
  await page.evaluate(() => {
    localStorage.setItem(
      "codehq.ui",
      JSON.stringify({ state: { theme: "light", depth: "workflow" }, version: 1 }),
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-step-node]").first().waitFor({ state: "visible", timeout: 20_000 });

  // Prefer light theme for clearer review shots.
  const themeToggle = page.getByRole("button", { name: /switch to (light|dark) theme/i });
  if (await themeToggle.isVisible().catch(() => false)) {
    const label = await themeToggle.getAttribute("aria-label");
    if (label?.toLowerCase().includes("light")) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }
  }

  await page.getByRole("group", { name: "Canvas altitude" }).getByRole("button", { name: "Story", exact: true }).click();
  // Blur the altitude control so the focus-within tooltip is not stuck open for the Story board shot.
  await page.locator("h1").first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "01-story.png"), fullPage: false });

  // Tooltip under the control (hover the altitude group).
  const altitude = page.getByRole("group", { name: "Canvas altitude" });
  await altitude.hover();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, "02-story-tooltip.png"), fullPage: false });

  await page.getByRole("group", { name: "Canvas altitude" }).getByRole("button", { name: "Code map", exact: true }).click();
  await page.locator("h1").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "03-code-map.png"), fullPage: false });

  // Zoom into a single node that has files + I/O for a clear Code map close-up.
  const scrape = page.locator('[data-step-node="scrape-website"]');
  if (await scrape.count()) {
    await scrape.scrollIntoViewIfNeeded();
    const box = await scrape.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(OUT, "04-code-map-node.png"),
        clip: {
          x: Math.max(0, box.x - 24),
          y: Math.max(0, box.y - 24),
          width: Math.min(520, box.width + 48),
          height: Math.min(360, box.height + 48),
        },
      });
    }
  }

  // Story close-up of the same node for comparison.
  await page.getByRole("group", { name: "Canvas altitude" }).getByRole("button", { name: "Story", exact: true }).click();
  await page.waitForTimeout(500);
  if (await scrape.count()) {
    await scrape.scrollIntoViewIfNeeded();
    const box = await scrape.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(OUT, "05-story-node.png"),
        clip: {
          x: Math.max(0, box.x - 24),
          y: Math.max(0, box.y - 24),
          width: Math.min(520, box.width + 48),
          height: Math.min(280, box.height + 48),
        },
      });
    }
  }

  await browser.close();
  process.stdout.write(`Wrote screenshots to ${OUT}\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
