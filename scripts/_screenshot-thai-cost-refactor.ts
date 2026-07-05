/**
 * Screenshot Thai cost refactor pages (local dev).
 * Run: npx tsx --env-file=.env.local scripts/_screenshot-thai-cost-refactor.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "scripts/_output/thai-cost-refactor");

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
  await page.goto(`${BASE}/dashboard`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  if (page.url().includes("/login")) {
    throw new Error("Login failed — still on login page");
  }
}

async function shot(
  page: import("playwright").Page,
  urlPath: string,
  name: string,
  mustInclude?: string[]
) {
  await page.goto(`${BASE}${urlPath}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  const bad =
    body.includes("Failed to compile") ||
    body.includes("Application error") ||
    body.includes("Unhandled Runtime Error");
  const missing = (mustInclude ?? []).filter((s) => !body.includes(s));
  console.log(`${name}: ok=${!bad && missing.length === 0} missing=[${missing.join(",")}]`);
  if (bad) throw new Error(`Page error on ${urlPath}`);
  if (missing.length > 0) {
    console.warn(`Warning: missing text on ${urlPath}: ${missing.join(", ")}`);
  }
  return file;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  // 1. Voucher
  await shot(
    page,
    "/thai-cost/sadao-voucher?date=2026-06-15",
    "01-sadao-voucher.png",
    ["Voucher", "合计"]
  );

  // 2. Driver trip daily entry + vehicle P&L table
  await shot(
    page,
    "/thai-cost/driver-trips?year=2026&month=6",
    "02-driver-trip-daily.png",
    ["司机趟次", "当月车辆盈亏"]
  );

  // 3. Daily overview
  await shot(
    page,
    "/thai-cost/daily-overview?date=2026-06-15",
    "03-daily-overview.png",
    ["Sadao", "宋卡", "北大年"]
  );

  // 4. Cross-check banner on Songkhla summary
  await shot(
    page,
    "/thai-cost/songkhla-summary?year=2026&month=6",
    "04-cross-check-banner.png",
    ["手动登记合计", "系统派车记录合计"]
  );

  // 5. New compressed menu — expand Thai Cost + Settings groups
  await page.goto(`${BASE}/dashboard`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(1000);

  const thaiCostBtn = page
    .locator("aside button, aside a")
    .filter({ hasText: /泰国成本|Thai Cost/ })
    .first();
  await thaiCostBtn.click();
  await page.waitForTimeout(500);

  const settingsBtn = page
    .locator("aside button, aside a")
    .filter({ hasText: /系统设置|Settings/ })
    .first();
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
  }

  const navText = await page.locator("aside").innerText();
  const hasDataEntry = navText.includes("数据录入") || navText.includes("Data Entry");
  const hasDailyOverview =
    navText.includes("每日总览") || navText.includes("Daily Overview");
  console.log(
    `05-menu: dataEntry=${hasDataEntry} dailyOverview=${hasDailyOverview}`
  );
  await page.screenshot({
    path: path.join(OUT, "05-menu-compressed.png"),
    fullPage: false,
  });

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
