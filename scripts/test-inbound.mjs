import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(`PAGE: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text()}`);
});

try {
  // Login
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@haideelogistics.com");
  await page.fill("#password", "haidee2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });

  // 1. Click Inbound menu
  await page.click('a[href="/inbound"]');
  await page.waitForURL("**/inbound", { timeout: 10000 });
  console.log("✓ Navigated to /inbound");

  // 2. Click New Inbound
  await page.click('a[href="/inbound/new"]');
  await page.waitForURL("**/inbound/new", { timeout: 10000 });
  console.log("✓ Navigated to /inbound/new");

  // 3. Select THAI TONG
  const shipperSelect = page.locator("select").first();
  const options = await shipperSelect.locator("option").all();
  let thaiTongValue = null;
  for (const opt of options) {
    const text = await opt.textContent();
    if (text?.includes("THAI TONG")) {
      thaiTongValue = await opt.getAttribute("value");
      break;
    }
  }
  if (!thaiTongValue) throw new Error("THAI TONG option not found in dropdown");
  await shipperSelect.selectOption(thaiTongValue);
  await page.waitForTimeout(1500);

  // 4. Check stalls loaded
  const stallRows = page.locator("tbody tr");
  const stallCount = await stallRows.count();
  console.log(`✓ Stall rows: ${stallCount}`);
  if (stallCount < 4) throw new Error(`Expected 4 stalls, got ${stallCount}`);

  const stallCodes = await stallRows.locator("td").first().allTextContents();
  console.log(`  Stalls: ${stallCodes.join(", ")}`);

  // 5. Fill quantities - H41 and F38 (KL), K38 (KD)
  const inputs = page.locator('input[inputmode="numeric"]');
  await inputs.nth(0).fill("34");
  await inputs.nth(1).fill("10");
  await inputs.nth(2).fill("5");
  await page.waitForTimeout(500);

  // Check market subtotals
  const subtotals = page.locator("text=各市场小计");
  if (!(await subtotals.isVisible())) throw new Error("Market subtotals not visible");
  const klTotal = page.locator("text=KL").locator("..").locator(".font-mono");
  console.log("✓ Market subtotals visible");

  // 6. Confirm save
  await page.click('button:has-text("确认保存")');
  await page.waitForURL("**/inbound", { timeout: 15000 });
  console.log("✓ Redirected to list after save");

  // Check list has THAI TONG record
  await page.waitForTimeout(1000);
  const tableText = await page.locator("table").textContent();
  if (!tableText?.includes("THAI TONG")) throw new Error("THAI TONG not in list");
  if (!tableText?.includes("IN-")) throw new Error("Session number not in list");
  console.log("✓ List shows THAI TONG record with batch number");

  // Screenshot form (re-navigate for clean shot)
  await page.goto(`${BASE}/inbound/new`);
  await shipperSelect.selectOption({ label: /THAI TONG/ });
  await page.waitForTimeout(1000);
  await inputs.nth(0).fill("34");
  await inputs.nth(1).fill("10");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "public/inbound-form-screenshot.png",
    fullPage: true,
  });
  console.log("✓ Screenshot saved");

  if (errors.length) {
    console.log("Warnings:", errors);
  }
  console.log("\nALL TESTS PASSED");
} catch (e) {
  console.error("FAILED:", e.message);
  await page.screenshot({ path: "public/inbound-test-failure.png", fullPage: true });
  if (errors.length) console.error("Errors:", errors);
  process.exit(1);
} finally {
  await browser.close();
}
