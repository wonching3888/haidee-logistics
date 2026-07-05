/**
 * Production: verify Din termination (commit 0a73136+) — settings, payslip, batch, July exclusion.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_verify-prod-din-termination-0a73136.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { prisma } from "@/lib/prisma";

const BASE = process.env.BASE_URL ?? "https://haidee-logistics.vercel.app";
const OUT = path.join(process.cwd(), "scripts/_output");
const COMMIT = process.env.VERIFY_COMMIT ?? "0a73136";

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#email");
  await page.locator("#email").fill(
    process.env.ADMIN_EMAIL ?? "admin@haideelogistics.com"
  );
  await page.locator("#password").fill(
    process.env.ADMIN_PASSWORD ?? "haidee2026"
  );
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(8000);
  if (page.url().includes("/login")) {
    throw new Error("Login failed");
  }
}

function mustInclude(text: string, needles: string[], label: string) {
  const missing = needles.filter((n) => !text.includes(n));
  if (missing.length) {
    throw new Error(`${label} missing: ${missing.join(", ")}`);
  }
  console.log(`OK ${label}`);
}

async function screenshot(page: Page, name: string, locator?: Locator) {
  const file = path.join(OUT, name);
  if (locator && (await locator.count()) > 0) {
    await locator.first().screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  console.log(`Screenshot: ${file}`);
}

async function verifySettings(page: Page) {
  await page.goto(`${BASE}/settings?section=driver-payroll`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(2000);

  const dinRow = page.locator("tr", { has: page.getByText("Din", { exact: true }) });
  if ((await dinRow.count()) === 0) {
    throw new Error("Din row not found in driver-payroll settings");
  }

  const rowText = await dinRow.first().innerText();
  mustInclude(rowText, ["550.00", "2026-06-10"], "Din settings table row");

  await dinRow.first().getByRole("button").first().click();
  await page.waitForSelector('input[type="date"]', { timeout: 15000 });

  const terminationInput = page.locator('input[type="date"]').first();
  const baseSalaryInput = page.locator('input[type="number"]').first();
  const termVal = await terminationInput.inputValue();
  const baseVal = await baseSalaryInput.inputValue();

  if (termVal !== "2026-06-10") {
    throw new Error(`Din termination date=${termVal}, expected 2026-06-10`);
  }
  if (baseVal !== "550") {
    throw new Error(`Din baseSalary=${baseVal}, expected 550`);
  }
  console.log("OK Din edit dialog: termination=2026-06-10 baseSalary=550");

  const dialog = page.locator('[role="dialog"]');
  await screenshot(page, "prod-din-settings-dialog-0a73136.png", dialog);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await screenshot(page, "prod-din-settings-table-0a73136.png");
}

async function verifyJunePayslip(page: Page, dinId: string) {
  const url = `${BASE}/driver-payroll/print?driverId=${encodeURIComponent(dinId)}&year=2026&month=6`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector(".driver-payslip-print");

  const labels = await page
    .locator(".payslip-amount-table tr td:first-child")
    .allTextContents();
  const trimmed = labels.map((l) => l.trim());

  for (const expected of ["ADVANCE", "ADV RECOVERED", "ADV WRITEOFF"]) {
    if (!trimmed.includes(expected)) {
      throw new Error(`Payslip missing row ${expected}; got: ${trimmed.join(", ")}`);
    }
  }

  const amounts = await page
    .locator(".payslip-amount-table tr")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll("td");
        return {
          label: cells[0]?.textContent?.trim() ?? "",
          value: cells[1]?.textContent?.trim() ?? "",
        };
      })
    );

  const byLabel = Object.fromEntries(amounts.map((r) => [r.label, r.value]));
  mustInclude(
    JSON.stringify(byLabel),
    ["1500.00", "804.26", "695.74"],
    "Din payslip advance amounts"
  );

  console.log("OK Din June payslip advance rows:", byLabel);
  await screenshot(
    page,
    "prod-din-payslip-june-2026-0a73136.png",
    page.locator(".driver-payslip-print")
  );
}

async function verifyJuneBatch(page: Page) {
  const url = `${BASE}/driver-payroll/print/batch?year=2026&month=6`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector(".driver-payslip-batch-page", { timeout: 120000 });

  const header = await page.locator("h1, .document-print-header, header").first().innerText().catch(() => "");
  const body = await page.locator("body").innerText();

  if (!body.includes("14") && !header.includes("14")) {
    throw new Error(`Batch page should show 14 drivers; header=${header.slice(0, 120)}`);
  }
  if (!body.includes("Din")) {
    throw new Error("Din not found in June batch payslip page");
  }

  const payslipCount = await page.locator(".driver-payslip-print").count();
  if (payslipCount !== 14) {
    throw new Error(`Expected 14 payslips in batch, got ${payslipCount}`);
  }

  console.log(`OK June batch: ${payslipCount} payslips including Din`);
  await screenshot(page, "prod-din-batch-june-2026-header-0a73136.png");

  const dinPayslip = page.locator(".driver-payslip-print", {
    has: page.getByText("Din", { exact: true }),
  });
  if ((await dinPayslip.count()) > 0) {
    await screenshot(
      page,
      "prod-din-batch-june-2026-payslip-0a73136.png",
      dinPayslip.first()
    );
  }
}

async function verifyJulyExcluded(page: Page) {
  await page.goto(`${BASE}/driver-payroll?year=2026&month=7`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(3000);

  const body = await page.locator("body").innerText();
  const driverSelect = page.locator('select, [role="combobox"]').first();
  let optionTexts: string[] = [];

  if ((await driverSelect.count()) > 0) {
    optionTexts = await page.locator("option").allTextContents();
  }

  const hasDinInSelect = optionTexts.some((t) => t.trim() === "Din");
  const hasDinInSummary =
    body.includes("\nDin\n") ||
    body.match(/\bDin\b/) !== null &&
      (body.includes("Din\t") || body.includes("Din "));

  if (hasDinInSelect) {
    throw new Error("Din still appears in July driver dropdown");
  }

  const summaryRows = page.locator("table tbody tr");
  const rowCount = await summaryRows.count();
  for (let i = 0; i < rowCount; i++) {
    const rowText = await summaryRows.nth(i).innerText();
    if (rowText.startsWith("Din") || rowText.includes("\nDin\n")) {
      throw new Error("Din found in July summary table");
    }
  }

  console.log(`OK July payroll: Din excluded (${rowCount} summary rows)`);
  await screenshot(page, "prod-payroll-july-2026-no-din-0a73136.png");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const din = await prisma.driver.findFirst({
    where: { name: "Din" },
    select: {
      id: true,
      name: true,
      baseSalary: true,
      terminationDate: true,
      active: true,
    },
  });
  if (!din) throw new Error("Din not found in DB");

  console.log("DB Din:", {
    id: din.id,
    baseSalary: din.baseSalary?.toString(),
    terminationDate: din.terminationDate?.toISOString().slice(0, 10),
    active: din.active,
  });
  console.log(`Verify commit target: ${COMMIT}`);
  console.log(`Production base: ${BASE}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  try {
    await login(page);
    await verifySettings(page);
    await verifyJunePayslip(page, din.id);
    await verifyJuneBatch(page);
    await verifyJulyExcluded(page);
    console.log("\nAll production checks passed.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
