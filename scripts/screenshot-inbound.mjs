import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto("http://localhost:3000/login");
await page.fill("#email", "admin@haideelogistics.com");
await page.fill("#password", "haidee2026");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");

await page.goto("http://localhost:3000/inbound/new");
await page.waitForLoadState("networkidle");

const shipperSelect = page.locator("select").first();
const options = await shipperSelect.locator("option").all();
for (const opt of options) {
  const text = await opt.textContent();
  if (text?.includes("THAI TONG")) {
    await shipperSelect.selectOption(await opt.getAttribute("value"));
    break;
  }
}
await page.waitForTimeout(1500);

const inputs = page.locator('input[inputmode="numeric"]');
await inputs.nth(0).fill("34");
await inputs.nth(1).fill("10");
await inputs.nth(2).fill("5");
await page.waitForTimeout(800);

await page.screenshot({
  path: "public/inbound-form-screenshot.png",
  fullPage: true,
});
console.log("Screenshot saved: public/inbound-form-screenshot.png");

await browser.close();
