import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3012";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(`PAGE: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text()}`);
});

async function assertNoError(label) {
  const rscError = page.getByText(/Server Components render error/i);
  const pageLoadFailed = page.getByText(/页面加载失败 Page load failed/i);
  const redErrorBox = page.locator(".bg-red-50").filter({
    hasText: /error|失败|render|Something went wrong/i,
  });

  const hasRsc = await rscError.isVisible().catch(() => false);
  const hasPageFail = await pageLoadFailed.isVisible().catch(() => false);
  const redCount = await redErrorBox.count();

  if (hasRsc || hasPageFail || redCount > 0) {
    await page.screenshot({
      path: `public/inbound-edit-tong-type-failure-${label}.png`,
      fullPage: true,
    });
    throw new Error(
      `${label}: error UI (rsc=${hasRsc}, pageFail=${hasPageFail}, red=${redCount})`
    );
  }
}

async function changeFirstTongType() {
  const firstSelect = page.locator("tbody select").first();
  const current = await firstSelect.inputValue();
  const options = await firstSelect.locator("option").all();
  for (const opt of options) {
    const v = await opt.getAttribute("value");
    if (v && v !== current) {
      await firstSelect.selectOption(v);
      return v;
    }
  }
  throw new Error("No alternate tong type option");
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "admin@haideelogistics.com");
  await page.fill("#password", "haidee2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });
  await page.goto(`${BASE}/inbound`, { waitUntil: "networkidle", timeout: 60000 });

  const editLinks = page.locator('a[href$="/edit"]');
  const count = await editLinks.count();
  if (count === 0) throw new Error("No edit links found");

  const tested = Math.min(count, 5);
  const hrefs = [];
  for (let i = 0; i < tested; i++) {
    hrefs.push(await editLinks.nth(i).getAttribute("href"));
  }

  for (let i = 0; i < hrefs.length; i++) {
    const href = hrefs[i];
    if (!href) continue;
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const hasFreight = await page.getByText("车力信息 Freight Details").isVisible().catch(() => false);
    console.log(`[${i + 1}/${hrefs.length}] ${href} freight=${hasFreight}`);

    await assertNoError(`load-${i}`);

    const qtyInputs = page.locator('input[inputmode="numeric"]');
    if ((await qtyInputs.count()) > 0 && (await qtyInputs.first().inputValue()) === "") {
      await qtyInputs.first().fill("5");
      await page.waitForTimeout(800);
      await assertNoError(`qty-${i}`);
    }

    await changeFirstTongType();
    await page.waitForTimeout(1200);
    await assertNoError(`tong-${i}`);
  }

  const fatal = errors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("Failed to load resource")
  );
  if (fatal.length) {
    console.log("Browser errors:", fatal);
    throw new Error(fatal.join("; "));
  }

  console.log("PASS: No error after tong type changes on edit pages");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  await browser.close();
}
