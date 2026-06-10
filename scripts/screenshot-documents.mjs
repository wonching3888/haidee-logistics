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

await page.goto(`${BASE}/documents`, { waitUntil: "networkidle" });
await page.screenshot({ path: "public/documents-page-screenshot.png", fullPage: true });

// Open internal DO preview
const internalBtn = page.locator('button:has-text("生成内部 D/O")');
if (await internalBtn.isEnabled()) {
  await internalBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "public/documents-do-preview-screenshot.png", fullPage: true });
}

console.log("Screenshots saved");
await browser.close();
