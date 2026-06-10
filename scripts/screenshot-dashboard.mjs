import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3006";
const out = process.argv[2] ?? "public/dashboard-screenshot.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
if (page.url().includes("/login")) {
  await page.fill("#email", "admin@haideelogistics.com");
  await page.fill("#password", "haidee2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });
}

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`Screenshot saved: ${out} (${BASE}/dashboard)`);
