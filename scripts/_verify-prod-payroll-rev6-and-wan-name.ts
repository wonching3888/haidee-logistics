/**
 * Production: verify June payroll rev6 numbers + Wan full name on payslip.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_verify-prod-payroll-rev6-and-wan-name.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { prisma } from "@/lib/prisma";

const BASE = process.env.BASE_URL ?? "https://haidee-logistics.vercel.app";
const OUT = path.join(process.cwd(), "scripts/_output");
const YEAR = 2026;
const MONTH = 6;

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

async function openPayroll(page: Page, driverId: string) {
  const url = `${BASE}/driver-payroll?driverId=${encodeURIComponent(driverId)}&year=${YEAR}&month=${MONTH}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  return page.locator("body").innerText();
}

async function openPayslipPrint(page: Page, driverId: string) {
  const url = `${BASE}/driver-payroll/print?driverId=${encodeURIComponent(driverId)}&year=${YEAR}&month=${MONTH}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);
  return page.locator("body").innerText();
}

function mustInclude(text: string, needles: string[], label: string) {
  const missing = needles.filter((n) => !text.includes(n));
  if (missing.length) {
    throw new Error(`${label} missing: ${missing.join(", ")}`);
  }
  console.log(`OK ${label}: found ${needles.join(" | ")}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const wan = await prisma.driver.findFirst({
    where: { name: "Wan" },
    select: { id: true, fullName: true, icNumber: true },
  });
  const pinat = await prisma.driver.findFirst({
    where: { name: "Pinat" },
    select: { id: true, fullName: true },
  });
  if (!wan || !pinat) throw new Error("Wan or Pinat not found");

  console.log("DB Wan fullName:", wan.fullName);
  console.log("DB Wan id:", wan.id);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await login(page);

  // Wan payroll page
  const wanText = await openPayroll(page, wan.id);
  await page.screenshot({
    path: path.join(OUT, "prod-payroll-wan-june-2026-rev6.png"),
    fullPage: true,
  });
  mustInclude(
    wanText,
    ["1481.37", "11.65"],
    "Wan payroll page NET/PCB"
  );

  // Pinat payroll page
  const pinatText = await openPayroll(page, pinat.id);
  await page.screenshot({
    path: path.join(OUT, "prod-payroll-pinat-june-2026-rev6.png"),
    fullPage: true,
  });
  mustInclude(
    pinatText,
    ["2405.82", "612", "561"],
    "Pinat payroll page NET/EPF"
  );

  // Wan payslip print (NAME)
  const payslipText = await openPayslipPrint(page, wan.id);
  await page.screenshot({
    path: path.join(OUT, "prod-payslip-wan-june-2026-name.png"),
    fullPage: true,
  });
  // Focus payslip area if present
  const payslip = page.locator(".driver-payslip-print");
  if ((await payslip.count()) > 0) {
    await payslip.screenshot({
      path: path.join(OUT, "prod-payslip-wan-june-2026-name-cropped.png"),
    });
  }

  const expectedName = "Wan Syafirul Hafiq Bin Wan Mustafa";
  if (payslipText.includes(expectedName)) {
    console.log(`OK Wan payslip NAME: ${expectedName}`);
  } else if (payslipText.includes("Mustafa") && !payslipText.includes("Syafirul")) {
    console.log("WARN Wan payslip still shows old name Mustafa — fullName not updated yet");
  } else {
    console.log("Wan payslip text snippet:", payslipText.slice(0, 500));
  }

  await browser.close();
  console.log("\nScreenshots written to scripts/_output/");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
