/**
 * Verify payslip letterhead: English-only, Changloon address, logo visible.
 * Run: node --env-file=.env.local --import tsx scripts/_screenshot-payslip-en-only-june-2026.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverPayslipWithListingPrint } from "../components/driver-payroll/DriverPayslipWithListingPrint";
import { loadBatchDriverPayslipEntries } from "../lib/driver-payslip-batch";
import { prisma } from "../lib/prisma";

const OUT_DIR = path.join(process.cwd(), "scripts/_output");
const YEAR = 2026;
const MONTH = 6;
/** Awang payroll name is Sharif Bin Mat */
const SPOT = ["Awang", "Akim"] as const;
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const css = fs.readFileSync(
    path.join(process.cwd(), "components/driver-payroll/driver-payslip-print.css"),
    "utf8"
  );

  const batch = await loadBatchDriverPayslipEntries(YEAR, MONTH);
  fs.copyFileSync(
    path.join(process.cwd(), "public/logo.png"),
    path.join(OUT_DIR, "logo.png")
  );

  for (const name of SPOT) {
    const entry = batch.entries.find((e) => e.driver.name === name);
    if (!entry) throw new Error(`Missing ${name}`);

    const body = renderToStaticMarkup(
      React.createElement(DriverPayslipWithListingPrint, {
        year: batch.year,
        month: batch.month,
        driver: entry.driver,
        summary: entry.summary,
        advances: entry.advances,
        tripListingRows: entry.tripListingRows,
      })
    );

    const cjkMatches = body.match(new RegExp(CJK.source, "g"));
    if (cjkMatches?.length) {
      throw new Error(
        `${name} print HTML contains CJK: ${[...new Set(cjkMatches)].join("")}`
      );
    }
    if (!body.includes("Changloon") || body.includes("Changlong")) {
      throw new Error(`${name} address typo: expected Changloon`);
    }
    if (!body.includes('src="/logo.png"')) {
      throw new Error(`${name} missing logo src`);
    }

    const slug = name.toLowerCase();
    const htmlPath = path.join(OUT_DIR, `payslip-trip-listing-en-${slug}-june-2026.html`);
    const payslipPng = path.join(OUT_DIR, `payslip-en-${slug}-june-2026.png`);
    const letterheadPng = path.join(OUT_DIR, `payslip-letterhead-en-${slug}-june-2026.png`);
    const listingPng = path.join(OUT_DIR, `trip-listing-en-${slug}-june-2026.png`);

    const htmlBody = body.replace('src="/logo.png"', 'src="logo.png"');
    fs.writeFileSync(
      htmlPath,
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:24px;background:#f1f5f9}${css}</style></head><body><div style="max-width:210mm;margin:0 auto;background:#fff;padding:24px">${htmlBody}</div></body></html>`,
      "utf8"
    );

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.locator(".payslip-letterhead").screenshot({ path: letterheadPng });
    await page.locator(".driver-payslip-print").screenshot({ path: payslipPng });
    await page.locator(".trip-listing-print").screenshot({ path: listingPng });
    await browser.close();

    console.log(`${name} (${entry.driver.payrollName}): English-only + Changloon + logo OK`);
    console.log(`  Letterhead: ${letterheadPng}`);
    console.log(`  Payslip: ${payslipPng}`);
    console.log(`  Trip listing: ${listingPng}`);
  }

  console.log("\nInternal Summary page unchanged (bilingual) — e.g. DriverPayrollSummaryTable");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
