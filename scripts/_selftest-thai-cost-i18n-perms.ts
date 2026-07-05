/**
 * Self-test: Thai cost clerk permissions + Thai i18n + Sadao Voucher print.
 * Run: npx tsx --env-file=.env.local scripts/_selftest-thai-cost-i18n-perms.ts
 *
 * Uses test-clerk@ / test-thai-accounting@ by default (see _thai-cost-test-users.ts).
 * Optional override: CLERK_EMAIL, CLERK_PASSWORD, THAI_ACCOUNTING_EMAIL, THAI_ACCOUNTING_PASSWORD
 * Optional: BASE_URL (default http://localhost:3000)
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import {
  TEST_CLERK_EMAIL,
  TEST_PASSWORD,
  TEST_THAI_ACCOUNTING_EMAIL,
} from "./_thai-cost-test-users";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "scripts/_output/thai-cost-i18n-perms");

type Creds = { email: string; password: string; label: string };

function supabaseAuthCookieName() {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

async function injectAuthSession(page: Page, creds: Creds) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error || !data.session) {
    throw new Error(`${creds.label} auth failed: ${error?.message ?? "no session"}`);
  }

  const payload = {
    access_token: data.session.access_token,
    token_type: "bearer",
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
    refresh_token: data.session.refresh_token,
    user: data.session.user,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  const host = new URL(BASE).hostname;

  await page.context().addCookies([
    {
      name: supabaseAuthCookieName(),
      value: `base64-${encoded}`,
      domain: host,
      path: "/",
      expires: data.session.expires_at ?? undefined,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

async function login(page: Page, creds: Creds) {
  await page.context().clearCookies();
  await injectAuthSession(page, creds);
  await page.goto(`${BASE}/thai-cost/attendance`, {
    waitUntil: "load",
    timeout: 120000,
  });
  if (page.url().includes("/login")) {
    throw new Error(`${creds.label} login failed — session cookie not accepted`);
  }
  await page.waitForSelector("aside", { timeout: 120000 });
}

async function logout(page: Page) {
  await page.context().clearCookies();
}

async function switchToThai(page: Page) {
  const thBtn = page.getByRole("button", { name: "ไทย", exact: true });
  await thBtn.click();
  await page.waitForTimeout(2000);
}

async function shot(page: Page, name: string) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log("screenshot:", file);
  return file;
}

async function navText(page: Page) {
  await page.waitForSelector("aside", { timeout: 60000 });
  const thaiCostBtn = page
    .locator("aside button, aside a")
    .filter({ hasText: /泰国成本|Thai Cost|ต้นทุนไทย/ })
    .first();
  if (await thaiCostBtn.count()) {
    await thaiCostBtn.click();
    await page.waitForTimeout(500);
  }
  return page.locator("aside").innerText();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results: string[] = [];

  const clerk: Creds = {
    email: process.env.CLERK_EMAIL ?? TEST_CLERK_EMAIL,
    password: process.env.CLERK_PASSWORD ?? TEST_PASSWORD,
    label: "clerk",
  };

  const thaiAcct: Creds = {
    email: process.env.THAI_ACCOUNTING_EMAIL ?? TEST_THAI_ACCOUNTING_EMAIL,
    password: process.env.THAI_ACCOUNTING_PASSWORD ?? TEST_PASSWORD,
    label: "thai_accounting",
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await login(page, clerk);
  {
    const nav = await navText(page);
    const hasMonthlySummary =
      nav.includes("月度汇总") ||
      nav.includes("Monthly Summary") ||
      nav.includes("สรุปรายเดือน");
    results.push(`clerk nav monthly summary visible: ${hasMonthlySummary} (expect false)`);
    await shot(page, "01-clerk-nav.png");

    await page.goto(`${BASE}/thai-cost/sadao-summary?year=2026&month=6`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);
    const blocked = !page.url().includes("/thai-cost/sadao-summary");
    results.push(`clerk direct sadao-summary blocked: ${blocked} (expect true), url=${page.url()}`);
    await shot(page, "02-clerk-blocked-summary.png");

    await page.goto(`${BASE}/thai-cost/attendance?year=2026&month=6`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await switchToThai(page);
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    const hasThai =
      body.includes("เข้างานรายวัน") || body.includes("บันทึกข้อมูล");
    results.push(`clerk attendance Thai UI: ${hasThai} (expect true)`);
    await shot(page, "03-clerk-attendance-th.png");

    await page.goto(`${BASE}/thai-cost/daily-overview?date=2026-06-15`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);
    await shot(page, "04-clerk-daily-overview-th.png");

    await logout(page);
  }

  await login(page, thaiAcct);
  {
    const nav = await navText(page);
    const hasMonthlySummary =
      nav.includes("月度汇总") ||
      nav.includes("Monthly Summary") ||
      nav.includes("สรุปรายเดือน");
    results.push(
      `thai_accounting nav monthly summary visible: ${hasMonthlySummary} (expect true)`
    );
    await shot(page, "05-thai-acct-nav.png");

    await page.goto(`${BASE}/thai-cost/sadao-summary?year=2026&month=6`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);
    const ok = page.url().includes("/thai-cost/sadao-summary");
    results.push(`thai_accounting sadao-summary accessible: ${ok} (expect true)`);
    await shot(page, "06-thai-acct-sadao-summary.png");

    await switchToThai(page);
    await page.waitForTimeout(1500);
    await shot(page, "07-thai-acct-summary-th.png");

    await logout(page);
  }

  await login(page, thaiAcct);
  await page.goto(`${BASE}/thai-cost/sadao-voucher?date=2026-06-15`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2000);
    const printArea = page.locator(".document-print");
    if ((await printArea.count()) > 0) {
      await printArea.first().screenshot({
        path: path.join(OUT, "08-sadao-voucher-print.png"),
      });
      const printText = await printArea.first().innerText();
      const hasChinese = /[\u4e00-\u9fff]/.test(printText);
      const hasThaiEn =
        printText.includes("Sadao") &&
        (printText.includes("วันที่") || printText.includes("Date"));
      results.push(`voucher print no Chinese: ${!hasChinese} (expect true)`);
      results.push(`voucher print Thai+EN: ${hasThaiEn} (expect true)`);
      console.log("voucher print sample:", printText.slice(0, 200));
    } else {
      results.push("voucher print: no .document-print found (maybe no data)");
      await shot(page, "08-sadao-voucher-no-print.png");
    }

  await browser.close();

  console.log("\n=== SELF-TEST RESULTS ===");
  for (const r of results) console.log(r);

  const failed = results.some((r) => {
    const m = r.match(/^(.+): (true|false) \(expect (true|false)\)/);
    if (!m) return false;
    return m[2] !== m[3];
  });
  if (failed) {
    throw new Error("Some self-test checks failed — see results above");
  }
  console.log("SELF-TEST OK");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
