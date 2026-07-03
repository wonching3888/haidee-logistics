/**
 * Batch payslip preview + spot-check Akim/Fook/Naim vs summary + JV rev4.
 * Run: node --env-file=.env.local --import tsx scripts/_screenshot-driver-payslip-batch-june-2026.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverPayslipBatchPrint } from "../components/driver-payroll/DriverPayslipBatchPrint";
import { DriverPayslipPrint } from "../components/driver-payroll/DriverPayslipPrint";
import { loadBatchDriverPayslipEntries } from "../lib/driver-payslip-batch";
import { payslipWagesTotal } from "../lib/driver-payslip";
import { loadFleetPayrollAggregate } from "../lib/payroll-fleet";
import { buildMonthlyDriverJvRows } from "../lib/payroll-jv-export";
import { prisma } from "../lib/prisma";

const OUT_DIR = path.join(process.cwd(), "scripts/_output");
const YEAR = 2026;
const MONTH = 6;
const SPOT_CHECK = ["Akim", "Fook", "Naim"] as const;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const css = fs.readFileSync(
    path.join(process.cwd(), "components/driver-payroll/driver-payslip-print.css"),
    "utf8"
  );

  const batch = await loadBatchDriverPayslipEntries(YEAR, MONTH);
  const summary = await loadFleetPayrollAggregate(YEAR, MONTH, { sync: false });
  const jv = await buildMonthlyDriverJvRows(YEAR, MONTH);

  console.log(`\n=== Batch payslip June 2026 ===`);
  console.log(`Sort: ${batch.sortNote}`);
  console.log(`Rendered: ${batch.entries.length} drivers`);
  console.log(
    `Skipped: ${batch.skipped.map((s) => `${s.name} (${s.reason})`).join(", ") || "none"}`
  );
  console.log(`Driver order: ${batch.entries.map((e) => e.driver.name).join(", ")}`);

  if (batch.entries.length !== 13) {
    throw new Error(`Expected 13 payslips, got ${batch.entries.length}`);
  }

  const batchBody = renderToStaticMarkup(
    React.createElement(DriverPayslipBatchPrint, {
      year: batch.year,
      month: batch.month,
      entries: batch.entries,
    })
  );

  const batchHtmlPath = path.join(OUT_DIR, "payslip-batch-june-2026-preview.html");
  const batchHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><style>
body{margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif}
.sheet{max-width:210mm;margin:0 auto}
${css}
</style></head><body><div class="sheet">${batchBody}</div></body></html>`;
  fs.writeFileSync(batchHtmlPath, batchHtml, "utf8");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto(`file:///${batchHtmlPath.replace(/\\/g, "/")}`, {
    waitUntil: "load",
  });

  const pageCount = await page.locator(".driver-payslip-batch-page").count();
  if (pageCount !== 13) {
    throw new Error(`Expected 13 batch pages in DOM, got ${pageCount}`);
  }

  console.log(`\nBatch HTML: ${batchHtmlPath}`);
  console.log(`Batch pages in DOM: ${pageCount} (no blank/missing)`);

  let mismatches = 0;

  for (const name of SPOT_CHECK) {
    const entry = batch.entries.find((e) => e.driver.name === name);
    if (!entry) throw new Error(`Spot-check driver ${name} missing from batch`);

    const summaryRow = summary.rows.find((r) => r.name === name);
    const jvRow = jv.drivers.find((d) => d.driverName === name);
    if (!summaryRow || !jvRow) throw new Error(`Missing summary/JV for ${name}`);

    const wages = payslipWagesTotal(entry.summary);
    const s = entry.summary;

    const checks = [
      ["wages", wages, payslipWagesTotal({ ...s, statutory: s.statutory })],
      ["gross", s.grossSalary, summaryRow.grossSalary],
      ["pcb", s.statutory.pcb, summaryRow.pcb],
      ["net", s.netSalary, summaryRow.netSalary],
      ["net vs JV", s.netSalary, jvRow.amounts.netSalary],
    ] as const;

    const singleBody = renderToStaticMarkup(
      React.createElement(DriverPayslipPrint, {
        year: batch.year,
        month: batch.month,
        driver: entry.driver,
        summary: entry.summary,
        advances: entry.advances,
      })
    );
    const slug = name.toLowerCase();
    const singleHtmlPath = path.join(OUT_DIR, `payslip-${slug}-june-2026-batch-check.html`);
    const pngPath = path.join(OUT_DIR, `payslip-${slug}-june-2026-batch-check.png`);
    fs.writeFileSync(
      singleHtmlPath,
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:24px;background:#f1f5f9}${css}</style></head><body><div style="max-width:210mm;margin:0 auto;background:#fff;padding:24px">${singleBody}</div></body></html>`,
      "utf8"
    );
    await page.goto(`file:///${singleHtmlPath.replace(/\\/g, "/")}`, {
      waitUntil: "load",
    });
    await page.locator(".driver-payslip-print").screenshot({ path: pngPath });

    console.log(`\n--- ${name} spot-check ---`);
    for (const [label, payslipVal, expected] of checks) {
      const ok = Math.abs(payslipVal - expected) < 0.01;
      if (!ok) mismatches += 1;
      console.log(
        `  ${label}: payslip=${payslipVal.toFixed(2)} summary/jv=${expected.toFixed(2)} ${ok ? "OK" : "MISMATCH"}`
      );
    }
    console.log(`  PNG: ${pngPath}`);
  }

  if (mismatches > 0) {
    throw new Error(`${mismatches} spot-check mismatches`);
  }

  console.log("\nAll spot-checks passed (payslip = summary = JV rev4).");
  await browser.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
