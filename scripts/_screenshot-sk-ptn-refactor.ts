/**
 * Screenshots for SK/PTN refactor verification.
 * Run: npx tsx --env-file=.env.local scripts/_screenshot-sk-ptn-refactor.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "scripts/_output/sk-ptn-refactor");

async function login(page: import("playwright").Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("#email");
  await page.locator("#email").fill(
    process.env.ADMIN_EMAIL ?? "admin@haideelogistics.com"
  );
  await page.locator("#password").fill(
    process.env.ADMIN_PASSWORD ?? "haidee2026"
  );
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  await page.goto(`${BASE}/settings?section=payroll-settings`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(OUT, "01-payroll-my-routes-only.png"),
    fullPage: true,
  });
  console.log("✓ payroll settings screenshot");

  await page.goto(`${BASE}/thai-cost/settings`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(OUT, "02-thai-routes-settings.png"),
    fullPage: true,
  });
  console.log("✓ thai cost settings + routes");

  await page.goto(`${BASE}/thai-cost/driver-trips?year=2026&month=6`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(OUT, "03-driver-trips-3row-layout.png"),
    fullPage: true,
  });

  const plateSelect = page.locator("form select.font-mono").first();
  await plateSelect.selectOption("Other");
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="手动输入车牌"]').fill("TEST-9999");
  await page.screenshot({
    path: path.join(OUT, "04-driver-trips-other-plate.png"),
    fullPage: false,
  });
  console.log("✓ driver trips layout + Other plate");

  await page.goto(`${BASE}/thai-cost/songkhla-handling?year=2026&month=6`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.getByRole("button", { name: /登记/ }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(OUT, "05-songkhla-handling-readonly-dispatch.png"),
    fullPage: true,
  });
  console.log("✓ songkhla handling auto totals");

  await browser.close();
  console.log(`\nScreenshots: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
