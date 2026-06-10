import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3005";
const results = [];

function report(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function expectEnabled(locator, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await locator.isEnabled()) return;
    await locator.page().waitForTimeout(200);
  }
  throw new Error("Element not enabled within timeout");
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  if (!page.url().includes("/login")) return;
  await page.fill("#email", "admin@haideelogistics.com");
  await page.fill("#password", "haidee2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

try {
  await login(page);

  // 1. Inbound new
  await page.goto(`${BASE}/inbound/new`, { waitUntil: "networkidle", timeout: 60000 });
  const inboundTitle = await page.locator("h2").first().textContent();
  if (!inboundTitle?.includes("进货")) {
    report("1. inbound/new 页面加载", false, "标题未找到");
  } else {
    report("1. inbound/new 页面加载", true);
  }

  const shipperSelect = page
    .locator("label")
    .filter({ hasText: /寄货人/ })
    .locator("..")
    .locator("select");
  const shipperValue = await shipperSelect
    .locator("option")
    .evaluateAll((opts) => opts.find((o) => o.value)?.value ?? null);
  if (!shipperValue) {
    report("1. inbound/new 提交", false, "无寄货人可选");
  } else {
    await shipperSelect.selectOption(shipperValue);
    const saveBtn = page.getByRole("button", { name: /确认保存/ });
    await saveBtn.waitFor({ state: "visible", timeout: 15000 });
    await expectEnabled(saveBtn, 15000);
    const qtyInput = page.locator('input[inputmode="numeric"]').first();
    await qtyInput.waitFor({ state: "visible", timeout: 15000 });
    await qtyInput.fill("10");
    await saveBtn.click();
    try {
      await page.waitForURL("**/inbound", { timeout: 20000 });
      report("1. inbound/new 提交", true, "跳转至 /inbound");
    } catch {
      const errText = await page.locator(".text-haidee-red, [role=alert]").allTextContents();
      report("1. inbound/new 提交", false, errText.join(" ") || "未跳转");
    }
  }

  // 2. Summary
  await page.goto(`${BASE}/summary`, { waitUntil: "networkidle", timeout: 60000 });
  const summaryLoaded = (await page.locator("h2").first().textContent())?.includes("总单");
  report("2. summary 页面加载", !!summaryLoaded);

  const bodyText = await page.locator("body").textContent();
  const dateMatch = bodyText?.match(/\d{2}\/\d{2}\/\d{4}/);
  report("2. summary DD/MM/YYYY", !!dateMatch, dateMatch?.[0] ?? "未找到日期格式");

  const hasTable = (await page.locator("table").count()) > 0;
  const hasNoData = bodyText?.includes("暂无") ?? false;
  report("2. summary 数据表格", hasTable, hasNoData ? "表格存在但可能无数据" : "有表格内容");

  // 3. Dispatch
  await page.goto(`${BASE}/dispatch`, { waitUntil: "networkidle", timeout: 60000 });
  const dispatchLoaded = (await page.locator("h2").first().textContent())?.includes("派车");
  report("3. dispatch 页面加载", !!dispatchLoaded);

  const hasMatrix = (await page.locator("table").count()) > 0;
  report("3. dispatch 派车矩阵", hasMatrix);

  await page.goto(`${BASE}/dispatch/new`, { waitUntil: "networkidle", timeout: 60000 });
  const truckSelect = page.locator("select").first();
  const marketCheckbox = page.locator('input[type="checkbox"]').first();
  const canSelect =
    (await truckSelect.count()) > 0 && (await marketCheckbox.count()) > 0;
  report("3. dispatch 选择车辆和市场", canSelect);

  // 4. Documents
  await page.goto(`${BASE}/documents`, { waitUntil: "networkidle", timeout: 60000 });
  const docsLoaded = (await page.locator("h2").first().textContent())?.includes("文件");
  report("4. documents 页面加载", !!docsLoaded);

  const genBtn = page.locator('button:has-text("生成内部 D/O")');
  const canGenerate = await genBtn.isEnabled().catch(() => false);
  if (await page.locator("text=当日暂无派车单").isVisible().catch(() => false)) {
    report("4. documents 生成文件", true, "页面正常，当日无派车单无法生成");
  } else if (canGenerate) {
    await genBtn.click();
    await page.waitForTimeout(3000);
    const preview = await page.locator('[role="dialog"], .fixed').first().isVisible().catch(() => false);
    report("4. documents 生成文件", preview, preview ? "预览对话框已打开" : "点击后无预览");
  } else {
    report("4. documents 生成文件", false, "生成按钮不可用");
  }

  // 5. Crate export
  await page.goto(`${BASE}/crate/export`, { waitUntil: "networkidle", timeout: 60000 });
  const exportLoaded = (await page.locator("h2").first().textContent())?.includes("归还");
  report("5. crate/export 页面加载", !!exportLoaded);

  const dateInput = page.locator('input[type="date"]');
  const exportShipper = page.locator("select").first();
  const formOk =
    (await dateInput.count()) > 0 && (await exportShipper.count()) > 0;
  report("5. crate/export 表单可填写", formOk);

  // 6. Crate stock
  await page.goto(`${BASE}/crate/stock`, { waitUntil: "networkidle", timeout: 60000 });
  const stockLoaded = (await page.locator("h2").first().textContent())?.includes("库存");
  report("6. crate/stock 页面加载", !!stockLoaded);

  const stockText = await page.locator("body").textContent();
  const hasNumbers = /\d+/.test(stockText ?? "");
  const hasStockTable = (await page.locator("table").count()) > 0;
  report(
    "6. crate/stock 库存显示",
    hasStockTable && hasNumbers,
    hasStockTable ? "表格已渲染" : "无表格"
  );

  if (pageErrors.length) {
    console.log("\nPage errors:", pageErrors);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    await page.screenshot({ path: "public/batch4-test-failure.png", fullPage: true });
    process.exit(1);
  }
} catch (e) {
  console.error("TEST CRASH:", e.message);
  await page.screenshot({ path: "public/batch4-test-failure.png", fullPage: true });
  process.exit(1);
} finally {
  await browser.close();
}
