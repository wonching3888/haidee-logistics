import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3005";
const SHIPPER_NAME = "测试商家A";
const QTY = "50";
const NOTE = "测试流程";
const results = [];

function report(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${step}${detail ? ` — ${detail}` : ""}`);
}

async function expectEnabled(locator, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await locator.isEnabled()) return;
    await locator.page().waitForTimeout(200);
  }
  throw new Error("Element not enabled within timeout");
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  if (page.url().includes("/login")) {
    await page.fill("#email", "admin@haideelogistics.com");
    await page.fill("#password", "haidee2026");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });
  }
}

// Ensure test shipper exists in DB
const setupOut = execSync("npx tsx scripts/setup-test-shipper.ts", {
  cwd: process.cwd(),
  encoding: "utf8",
}).trim();
const setup = JSON.parse(setupOut.split("\n").pop());
const marketCode = setup.marketCode;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
let sessionNo = "";

try {
  await login(page);

  // Step 1: Inbound
  await page.goto(`${BASE}/inbound/new`, { waitUntil: "networkidle" });
  const shipperSelect = page
    .locator("label")
    .filter({ hasText: /寄货人/ })
    .locator("..")
    .locator("select");

  const shipperOption = shipperSelect.locator("option", { hasText: SHIPPER_NAME });
  if ((await shipperOption.count()) === 0) {
    report("Step 1 入库录入", false, `找不到发货人 ${SHIPPER_NAME}`);
  } else {
    const shipperValue = await shipperOption.getAttribute("value");
    await shipperSelect.selectOption(shipperValue);
    await expectEnabled(page.getByRole("button", { name: /确认保存/ }));

    await page
      .locator("label")
      .filter({ hasText: /地区\/备注/ })
      .locator("..")
      .locator("input")
      .fill(NOTE);

    const qtyInput = page.locator('input[inputmode="numeric"]').first();
    await qtyInput.waitFor({ state: "visible" });
    await qtyInput.fill(QTY);

    await page.getByRole("button", { name: /确认保存/ }).click();
    await page.waitForURL("**/inbound", { timeout: 20000 });

    const inboundBody = await page.locator("body").textContent();
    const sessionMatch = inboundBody?.match(/IN-\d{8}-\d+/);
    sessionNo = sessionMatch?.[0] ?? "";
    const hasShipper = inboundBody?.includes(SHIPPER_NAME);
    const hasQty = inboundBody?.includes(QTY);
    report(
      "Step 1 入库录入",
      hasShipper && hasQty,
      sessionNo ? `入库编号 ${sessionNo}，${QTY}桶` : `已提交，列表含 ${SHIPPER_NAME} ${QTY}桶`
    );
  }

  // Step 2: Summary
  await page.goto(`${BASE}/summary`, { waitUntil: "networkidle" });
  const summaryBody = await page.locator("body").textContent();
  const dateMatch = summaryBody?.match(/\d{2}\/\d{2}\/\d{4}/);
  const label = `${SHIPPER_NAME} (${NOTE})`;
  const inSummary =
    summaryBody?.includes(label) || summaryBody?.includes(SHIPPER_NAME);
  const qtyInSummary = summaryBody?.includes(QTY) || summaryBody?.includes("50");
  report(
    "Step 2 每日总单",
    inSummary && qtyInSummary,
    inSummary
      ? `找到 ${label}，日期 ${dateMatch?.[0] ?? "?"}`
      : "未在总单中找到入库记录"
  );

  // Step 3: Dispatch matrix
  await page.goto(`${BASE}/dispatch`, { waitUntil: "networkidle" });
  const dispatchBody = await page.locator("body").textContent();
  const hasMatrix = (await page.locator("table").count()) > 0;
  const has50Pending =
    dispatchBody?.includes(SHIPPER_NAME) &&
    (dispatchBody?.includes("50") || dispatchBody?.match(/\b50\b/));
  report(
    "Step 3 派车矩阵",
    hasMatrix && has50Pending,
    has50Pending ? `${marketCode} 市场显示 50 桶待派` : "矩阵中未找到 50 桶"
  );

  // Step 3b: Create dispatch order
  await page.goto(`${BASE}/dispatch/new`, { waitUntil: "networkidle" });
  const truckSelect = page.locator("select").first();
  const truckOptions = await truckSelect.locator("option").evaluateAll((opts) =>
    opts.map((o) => o.value).filter(Boolean)
  );
  if (!truckOptions.length) {
    report("Step 3 派车操作", false, "无可用车辆");
  } else {
    await truckSelect.selectOption(truckOptions[0]);
    await page.locator('input[placeholder="Ahmad"]').fill("测试司机");

    await page
      .locator("label")
      .filter({ hasText: new RegExp(`^${marketCode}$`) })
      .locator('input[type="checkbox"]')
      .check();

    const cargoRow = page
      .locator(".rounded-lg.border")
      .filter({ hasText: SHIPPER_NAME })
      .filter({ hasText: marketCode });
    await cargoRow.waitFor({ state: "visible", timeout: 10000 });
    await cargoRow.locator('input[type="checkbox"]').first().check();

    await page.getByRole("button", { name: /确认派车/ }).click();
    try {
      await page.waitForURL("**/dispatch", { timeout: 20000 });
      report("Step 3 派车操作", true, "派车单已创建");
    } catch {
      const err = await page.locator(".text-haidee-red").allTextContents();
      report("Step 3 派车操作", false, err.join(" ") || "派车保存失败");
    }
  }

  // Step 4: Documents
  await page.goto(`${BASE}/documents`, { waitUntil: "networkidle" });
  const docsLoaded = (await page.locator("h2").first().textContent())?.includes("文件");
  report("Step 4 单据页面", !!docsLoaded);

  const testOrder = page
    .locator("table tbody tr")
    .filter({ hasText: "测试司机" })
    .last();
  if (await testOrder.count()) {
    await testOrder.click();
  }

  const genBtn = page.getByRole("button", { name: /生成内部 D\/O/ });
  if (await page.locator("text=当日暂无派车单").isVisible().catch(() => false)) {
    report("Step 4 生成 D/O", false, "当日无派车单");
  } else if (await genBtn.isEnabled()) {
    await genBtn.click();
    const preview = page.locator(".document-print");
    await preview.waitFor({ state: "visible", timeout: 10000 });
    const docText = (await preview.textContent()) ?? "";
    const today = new Date();
    const expectedDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const doDate = docText.match(/DATE:\s*(\d{2}\/\d{2}\/\d{4})/)?.[1];
    const checks = {
      date: doDate === expectedDate,
      shipper: docText.includes(SHIPPER_NAME),
      market: docText.includes(marketCode),
      qty: new RegExp(`T01${marketCode}${QTY}`).test(docText),
      doHeader: docText.includes("DELIVERY ORDER"),
    };
    const allOk = Object.values(checks).every(Boolean);
    report(
      "Step 4 生成 D/O",
      allOk,
      `日期:${doDate ?? "?"} 发货人:${checks.shipper ? "✓" : "✗"} 市场:${checks.market ? "✓" : "✗"} 桶数:${QTY}`
    );
  } else {
    report("Step 4 生成 D/O", false, "生成按钮不可用");
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    await page.screenshot({ path: "public/batch5-flow-failure.png", fullPage: true });
    process.exit(1);
  }
} catch (e) {
  console.error("FLOW CRASH:", e.message);
  await page.screenshot({ path: "public/batch5-flow-failure.png", fullPage: true });
  process.exit(1);
} finally {
  await browser.close();
}
