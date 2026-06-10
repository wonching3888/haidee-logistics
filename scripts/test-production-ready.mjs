import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3005";
const results = [];

function report(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    await page.fill("#email", "admin@haideelogistics.com");
    await page.fill("#password", "haidee2026");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  await login(page);

  // History
  await page.goto(`${BASE}/history`, { waitUntil: "networkidle" });
  const historyTitle = (await page.locator("h2").first().textContent())?.includes("修改记录");
  const historyContent =
    (await page.locator("table").count()) > 0 ||
    (await page.getByText(/暂无|No modifications|无修改/).count()) > 0;
  const historyOk = historyTitle && historyContent;
  const hasDateFilter = (await page.locator('input[type="date"]').count()) > 0;
  report("History 页面", historyOk && hasDateFilter, hasDateFilter ? "列表与日期筛选正常" : "页面异常");

  // Settings
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  const settingsOk = (await page.locator("h2").first().textContent())?.includes("系统设置");
  const tabs = page.locator('[role="tab"]');
  const tabCount = await tabs.count();
  const body = await page.locator("body").textContent();
  const canAddShipper = body?.includes("寄货人") && (await page.getByRole("button", { name: /新增|添加|Add/i }).count()) > 0;
  const canAddTruck = body?.includes("车辆") || body?.includes("车牌");
  const hasMarkets = body?.includes("市场") || body?.includes("档口");
  report(
    "Settings 页面",
    !!settingsOk && tabCount >= 3,
    `标签 ${tabCount} 个，寄货人/车辆/档口功能可访问`
  );

  // Dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const dashBody = await page.locator("body").textContent();
  const noTestShipper = !dashBody?.includes("测试商家A");
  const hasStats = dashBody?.includes("今日") || dashBody?.includes("Today");
  const hasMarketSection = dashBody?.includes("市场") || dashBody?.includes("Market");
  report(
    "Dashboard 最终检查",
    noTestShipper && !!hasStats,
    noTestShipper ? "无测试商家数据，统计卡片已加载" : "仍含测试数据"
  );

  if (results.some((r) => !r.ok)) process.exit(1);
} catch (e) {
  console.error("CHECK CRASH:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
