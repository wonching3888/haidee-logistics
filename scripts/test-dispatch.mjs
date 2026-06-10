import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@haideelogistics.com");
  await page.fill("#password", "haidee2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");

  await page.click('a[href="/dispatch"]');
  await page.waitForURL("**/dispatch");
  console.log("✓ Dispatch overview loaded");

  const matrix = page.locator("table");
  await matrix.waitFor({ timeout: 5000 });
  console.log("✓ Matrix table visible");

  await page.click('a[href*="/dispatch/new"]');
  await page.waitForURL("**/dispatch/new");
  console.log("✓ New dispatch page");

  const selects = page.locator("select");
  await selects.nth(0).selectOption({ index: 1 });
  await page.fill('input[placeholder="Ahmad"]', "Ahmad");
  await selects.nth(1).selectOption("KL");
  await page.waitForTimeout(1500);

  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.isVisible()) {
    await checkbox.check();
    console.log("✓ Cargo checkbox selected");
  }

  await page.click('button:has-text("确认派车")');
  await page.waitForURL("**/dispatch", { timeout: 15000 });
  console.log("✓ Redirected to dispatch list");

  const content = await page.content();
  if (!content.includes("DO-")) throw new Error("Dispatch order not in list");
  console.log("✓ Dispatch order created");

  await page.screenshot({
    path: "public/dispatch-screenshot.png",
    fullPage: true,
  });
  console.log("✓ Screenshot saved");
  console.log("\nALL DISPATCH TESTS PASSED");
} catch (e) {
  console.error("FAILED:", e.message);
  await page.screenshot({ path: "public/dispatch-test-failure.png", fullPage: true });
  process.exit(1);
} finally {
  await browser.close();
}
