/**
 * Verify inbound edit page on Vercel production (or BASE_URL).
 * Run: node scripts/verify-inbound-edit-production.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "https://haidee-logistics.vercel.app";
const SESSION_ID =
  process.env.SESSION_ID ?? "d7ad7259-67de-42be-8c9c-235ae10dfb65";
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? "admin@haideelogistics.com";
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? "haidee2026";

function hasErrorText(text) {
  return /Server Components render|Something went wrong|Application error|页面加载失败 Page load failed/i.test(
    text
  );
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

try {
  console.log("BASE:", BASE);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 30000 });

  const editUrl = `${BASE}/inbound/${SESSION_ID}/edit`;
  await page.goto(editUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);

  let body = await page.locator("body").innerText();
  if (hasErrorText(body)) {
    throw new Error("Error on initial load");
  }

  const tongSelects = page.locator("tbody select");
  const selectCount = await tongSelects.count();
  for (let i = 0; i < Math.min(selectCount, 3); i++) {
    const select = tongSelects.nth(i);
    const current = await select.inputValue();
    for (const opt of await select.locator("option").all()) {
      const value = await opt.getAttribute("value");
      if (value && value !== current) {
        await select.selectOption(value);
        await page.waitForTimeout(2000);
        body = await page.locator("body").innerText();
        if (hasErrorText(body)) {
          throw new Error(`Error after tong type change on row ${i + 1}`);
        }
        break;
      }
    }
  }

  const redBoxes = await page
    .locator('[role="alert"], .bg-red-50')
    .filter({ hasText: /error|失败|render|wrong/i })
    .count();
  if (redBoxes > 0) {
    throw new Error(`Found ${redBoxes} red error box(es)`);
  }

  const fatal = errors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("Failed to load resource")
  );
  if (fatal.length) {
    throw new Error(`Browser errors: ${fatal.join("; ")}`);
  }

  console.log("PASS: no error on production edit page");
} catch (e) {
  console.error("FAIL:", e.message);
  await page
    .screenshot({ path: "public/inbound-edit-production-failure.png", fullPage: true })
    .catch(() => {});
  process.exit(1);
} finally {
  await browser.close();
}
