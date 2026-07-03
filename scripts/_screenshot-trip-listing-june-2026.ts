/**
 * Trip listing + payslip screenshots (June 2026 rev4 spot-check).
 * Run: node --env-file=.env.local --import tsx scripts/_screenshot-trip-listing-june-2026.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverPayslipBatchPrint } from "../components/driver-payroll/DriverPayslipBatchPrint";
import { DriverPayslipWithListingPrint } from "../components/driver-payroll/DriverPayslipWithListingPrint";
import { payslipWagesTotal } from "../lib/driver-payslip";
import { loadBatchDriverPayslipEntries } from "../lib/driver-payslip-batch";
import {
  assertTripListingWagesMatchPayslip,
  tripListingWagesTotal,
} from "../lib/driver-trip-listing";
import { prisma } from "../lib/prisma";

const OUT_DIR = path.join(process.cwd(), "scripts/_output");
const YEAR = 2026;
const MONTH = 6;
const SPOT = ["Akim", "Fook"] as const;
const EXPECTED_WAGES: Record<(typeof SPOT)[number], number> = {
  Akim: 2930,
  Fook: 2810,
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const css = fs.readFileSync(
    path.join(process.cwd(), "components/driver-payroll/driver-payslip-print.css"),
    "utf8"
  );

  const batch = await loadBatchDriverPayslipEntries(YEAR, MONTH);
  console.log(`\n=== Trip listing June 2026 ===`);
  console.log(`Drivers: ${batch.entries.length} (Din skipped)`);

  if (batch.entries.length !== 13) {
    throw new Error(`Expected 13 drivers, got ${batch.entries.length}`);
  }

  for (const name of SPOT) {
    const entry = batch.entries.find((e) => e.driver.name === name);
    if (!entry) throw new Error(`Missing ${name}`);

    const wages = payslipWagesTotal(entry.summary);
    const listingTotal = tripListingWagesTotal(entry.tripListingRows);
    assertTripListingWagesMatchPayslip(entry.tripListingRows, entry.summary);

    const expected = EXPECTED_WAGES[name];
    if (Math.abs(wages - expected) > 0.01) {
      throw new Error(`${name} wages ${wages} !== expected ${expected}`);
    }
    console.log(
      `${name}: payslip WAGES=${wages.toFixed(2)} listing TOTAL=${listingTotal.toFixed(2)} OK`
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });

  for (const name of SPOT) {
    const entry = batch.entries.find((e) => e.driver.name === name)!;
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
    const slug = name.toLowerCase();
    const htmlPath = path.join(OUT_DIR, `payslip-trip-listing-${slug}-june-2026.html`);
    const payslipPng = path.join(OUT_DIR, `payslip-${slug}-june-2026-with-listing.png`);
    const listingPng = path.join(OUT_DIR, `trip-listing-${slug}-june-2026.png`);

    fs.writeFileSync(
      htmlPath,
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:24px;background:#f1f5f9}${css}</style></head><body><div style="max-width:210mm;margin:0 auto;background:#fff;padding:24px">${body}</div></body></html>`,
      "utf8"
    );
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.locator(".driver-payslip-print").screenshot({ path: payslipPng });
    await page.locator(".trip-listing-print").screenshot({ path: listingPng });
    console.log(`  ${name} payslip PNG: ${payslipPng}`);
    console.log(`  ${name} listing PNG: ${listingPng}`);
  }

  const batchBody = renderToStaticMarkup(
    React.createElement(DriverPayslipBatchPrint, {
      year: batch.year,
      month: batch.month,
      entries: batch.entries,
    })
  );
  const batchHtmlPath = path.join(OUT_DIR, "payslip-batch-trip-listing-june-2026.html");
  fs.writeFileSync(
    batchHtmlPath,
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:24px;background:#f1f5f9}${css}</style></head><body><div style="max-width:210mm;margin:0 auto">${batchBody}</div></body></html>`,
    "utf8"
  );
  await page.goto(`file:///${batchHtmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });

  const packageCount = await page.locator(".driver-payslip-package").count();
  if (packageCount !== 13) {
    throw new Error(`Expected 13 payslip packages, got ${packageCount}`);
  }

  const order: string[] = [];
  for (let i = 0; i < packageCount; i++) {
    const pkg = page.locator(".driver-payslip-package").nth(i);
    const hasPayslip = (await pkg.locator(".driver-payslip-print").count()) === 1;
    const hasListing = (await pkg.locator(".trip-listing-print").count()) === 1;
    if (!hasPayslip || !hasListing) {
      throw new Error(`Package ${i} missing payslip or trip listing`);
    }
    const driverText = await pkg.locator(".trip-listing-driver").textContent();
    order.push(driverText?.split("·")[0]?.trim() ?? `?${i}`);
  }

  console.log(`\nBatch structure: ${packageCount} packages (payslip+listing each)`);
  console.log(`Order: ${batch.entries.map((e) => e.driver.name).join(" → ")}`);

  const structurePng = path.join(OUT_DIR, "payslip-batch-trip-listing-structure-june-2026.png");
  await page.screenshot({ path: structurePng, fullPage: true });
  console.log(`Batch structure PNG: ${structurePng}`);

  await browser.close();
  console.log("\nAll trip listing checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
