import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
if (page.url().includes("/login")) {
  await page.fill("#email", "admin@haideelogistics.com");
  await page.fill("#password", "haidee2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

await page.goto(`${BASE}/dispatch`, { waitUntil: "networkidle" });
await page.screenshot({ path: "public/dispatch-overview-screenshot.png", fullPage: true });

await page.goto(`${BASE}/dispatch/new`, { waitUntil: "networkidle" });
const selects = page.locator("select");
await selects.nth(0).selectOption({ index: 1 });
await page.fill('input[placeholder="Ahmad"]', "Ahmad");
await selects.nth(1).selectOption("KL");
await page.waitForTimeout(1500);
const cb = page.locator('input[type="checkbox"]').first();
if (await cb.isVisible()) await cb.check();
await page.screenshot({ path: "public/dispatch-form-screenshot.png", fullPage: true });

console.log("Screenshots saved");
await browser.close();
