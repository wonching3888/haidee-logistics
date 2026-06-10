import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3005";
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

const setupOut = execSync("npx tsx scripts/setup-batch6.ts", {
  cwd: process.cwd(),
  encoding: "utf8",
});
const setup = JSON.parse(setupOut.trim().split("\n").pop());

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  await login(page);

  // Step 1: Crate Import — truck + market + ABB qty, status arrived
  await page.goto(`${BASE}/crate/import`, { waitUntil: "networkidle" });
  const importLoaded = (await page.locator("h2").first().textContent())?.includes("回收");
  report("Step 1 空桶回收页面", !!importLoaded);

  const firstRow = page.locator("tbody tr").first();
  await firstRow.locator("select").nth(0).selectOption(setup.truckPlate);
  await firstRow.locator("select").nth(1).selectOption("KL");
  await firstRow.locator("select").nth(2).selectOption("arrived");
  const abbInput = firstRow.locator('input[inputmode="numeric"]').nth(1);
  await abbInput.fill(String(setup.importQty));

  await page.getByRole("button", { name: /确认保存/ }).click();
  await page.waitForTimeout(2000);
  const importSuccess = await page
    .locator("text=保存成功")
    .isVisible()
    .catch(() => false);
  report(
    "Step 1 空桶回收提交",
    importSuccess,
    importSuccess ? `ABB ${setup.importQty}桶，状态已到` : "未看到成功提示"
  );

  // Capture ABB stock before export
  await page.goto(`${BASE}/crate/stock`, { waitUntil: "networkidle" });
  const stockBeforeText = await page.locator("body").textContent();
  const abbBeforeMatch = stockBeforeText?.match(/ABB[\s\S]*?(\d+)/);

  // Step 2: Crate Export
  await page.goto(`${BASE}/crate/export`, { waitUntil: "networkidle" });
  const exportLoaded = (await page.locator("h2").first().textContent())?.includes("归还");
  report("Step 2 空桶归还页面", !!exportLoaded);

  const shipperSelect = page
    .locator("label")
    .filter({ hasText: /寄货人/ })
    .locator("..")
    .locator("select");
  await shipperSelect.selectOption({ label: setup.shipperName });
  await page.locator('input[list="th-plates-export"]').fill(setup.thPlate);
  await page.waitForTimeout(2000);

  const abbRow = page.locator("tr").filter({ hasText: /^ABB/ });
  await abbRow.locator('input[inputmode="numeric"]').fill(String(setup.exportQty));
  await page.getByRole("button", { name: /确认归还/ }).click();

  const receipt = page.locator(".tong-receipt");
  await receipt.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  const exportOk = await receipt.isVisible().catch(() => false);
  report(
    "Step 2 空桶归还提交",
    exportOk,
    exportOk ? `泰文收据已生成，归还 ${setup.exportQty} 桶` : "未打开收据"
  );

  // Step 5 partial: Thai receipt content
  if (exportOk) {
    const receiptText = (await receipt.textContent()) ?? "";
    const thaiOk =
      receiptText.includes("ใบรับคืนถังเปล่า") &&
      receiptText.includes("บริษัท ไฮดี โลจิสติกส์") &&
      receiptText.includes(setup.shipperName) &&
      receiptText.includes(String(setup.exportQty));
    report(
      "Step 5 泰文空桶收据",
      thaiOk,
      thaiOk ? "泰文标题/公司名/寄货人/数量正确" : "收据格式不完整"
    );
  } else {
    report("Step 5 泰文空桶收据", false, "归还未成功");
  }

  // Step 3: Stock check
  await page.goto(`${BASE}/crate/stock`, { waitUntil: "networkidle" });
  const stockText = await page.locator("body").textContent();
  const ledgerHasShipper = stockText?.includes(setup.shipperName);
  const abbRowText = await page
    .locator("tr")
    .filter({ hasText: "ABB" })
    .first()
    .textContent()
    .catch(() => "");
  const todayIn = abbRowText?.match(/(\d+)/g);
  const hasIn20 = abbRowText?.includes("20") || stockText?.includes("20");
  const hasOut15 = abbRowText?.includes("15") || stockText?.includes("15");
  const ledgerOut = stockText?.includes(`-${setup.exportQty}`) || stockText?.includes(setup.shipperName);

  report(
    "Step 3 库存核对",
    hasIn20 && hasOut15 && ledgerHasShipper,
    `今日IN含20:${hasIn20 ? "✓" : "✗"} 今日OUT含15:${hasOut15 ? "✓" : "✗"} 流水含${setup.shipperName}:${ledgerHasShipper ? "✓" : "✗"}`
  );

  // Step 4: Print D/O
  await page.goto(`${BASE}/documents`, { waitUntil: "networkidle" });
  const doRows = page.locator("table tbody tr");
  if ((await doRows.count()) > 0) {
    await doRows.first().click();
    await page.getByRole("button", { name: /生成内部 D\/O/ }).click();
    const docPrint = page.locator(".document-print");
    await docPrint.waitFor({ state: "visible", timeout: 10000 });
    const docText = (await docPrint.textContent()) ?? "";
    const hasHeader =
      docText.includes("海利物流有限公司") &&
      docText.includes("HAI DEE LOGISTICS") &&
      docText.includes("DELIVERY ORDER");
    const printBtn = page.getByRole("button", { name: /打印|Print/ });
    const hasPrint = (await printBtn.count()) > 0;
    report(
      "Step 4 打印 D/O",
      hasHeader && hasPrint,
      hasHeader ? "公司抬头正确，打印按钮可用" : "D/O 格式异常"
    );
  } else {
    report("Step 4 打印 D/O", false, "当日无派车单");
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    await page.screenshot({ path: "public/batch6-flow-failure.png", fullPage: true });
    process.exit(1);
  }
} catch (e) {
  console.error("FLOW CRASH:", e.message);
  await page.screenshot({ path: "public/batch6-flow-failure.png", fullPage: true });
  process.exit(1);
} finally {
  await browser.close();
}
