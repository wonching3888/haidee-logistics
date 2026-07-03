/**
 * Regenerate June 2026 payroll JV (rev2) + void prior export in manifest.
 * Run: node --env-file=.env.local --import tsx scripts/_regenerate-june-2026-payroll-jv.ts
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import {
  buildMonthlyDriverJvRows,
  generatePayrollJvCsv,
} from "@/lib/payroll-jv-export";
import {
  payrollJvOutputPath,
  readPayrollJvManifest,
  registerPayrollJvExport,
  voidPayrollJvExport,
  writePayrollJvManifest,
} from "@/lib/payroll-jv-export-manifest";

const YEAR = 2026;
const MONTH = 6;
const YEAR_MONTH = "2026-06";
const OLD_FILENAME = "payroll-jv-2026-06.csv";
const NEW_FILENAME = "payroll-jv-2026-06-rev2-socso-lindung.csv";

async function main() {
  const result = await buildMonthlyDriverJvRows(YEAR, MONTH);

  console.log(`\n=== June 2026 Payroll JV Regeneration ===\n`);
  console.log(`Drivers in JV: ${result.drivers.length}`);
  console.log(`Skipped: ${result.skippedDrivers.map((d) => d.driverName).join(", ") || "none"}`);
  console.log(`All balanced: ${result.allBalanced}\n`);

  if (!result.allBalanced) {
    console.log("IMBALANCED DRIVERS:");
    for (const row of result.imbalancedDrivers) {
      console.log(
        `  ${row.driverName} ${row.jvNo}: debit=${row.debitTotal.toFixed(2)} credit=${row.creditTotal.toFixed(2)} imbalance=${row.imbalance.toFixed(2)}`
      );
    }
    process.exit(1);
  }

  console.log("| JVNo | Driver | 9006借 | 4102贷 | Lindung | 借合计 | 贷合计 | 平衡 |");
  console.log("|------|--------|-------:|-------:|--------:|-------:|-------:|:----:|");

  for (const jv of result.drivers) {
    const line9006 = jv.lines.find((l) => l.accountCode.startsWith("9006-"));
    const line4102 = jv.lines.find((l) => l.accountCode === "4102-0000");
    console.log(
      `| ${jv.jvNo} | ${jv.driverName} | ${(line9006?.debit ?? 0).toFixed(2)} | ${(line4102?.credit ?? 0).toFixed(2)} | ${jv.amounts.lindung24Jam.toFixed(2)} | ${jv.debitTotal.toFixed(2)} | ${jv.creditTotal.toFixed(2)} | ${jv.balanced ? "OK" : "FAIL"} |`
    );
  }

  const csv = generatePayrollJvCsv(result);
  const outDir = payrollJvOutputPath(".");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = payrollJvOutputPath(NEW_FILENAME);
  writeFileSync(outPath, csv, "utf8");

  const manifest = readPayrollJvManifest();
  const hasOld = manifest.entries.some(
    (e) => e.yearMonth === YEAR_MONTH && e.filename === OLD_FILENAME
  );
  if (!hasOld) {
    manifest.entries.push({
      yearMonth: YEAR_MONTH,
      filename: OLD_FILENAME,
      status: "void",
      revision: 1,
      driverCount: 13,
      exportedAt: "2026-06-28T00:00:00.000Z",
      voidReason: "作废-未发放前修正：旧SOCSO First Category表偏低 + 4102未含Lindung",
      voidedAt: new Date().toISOString(),
      supersededBy: NEW_FILENAME,
      notes: "原始CSV未入库；此为逻辑作废登记，避免与新导出混淆",
    });
    writePayrollJvManifest(manifest);
  } else {
    voidPayrollJvExport({
      yearMonth: YEAR_MONTH,
      filename: OLD_FILENAME,
      voidReason: "作废-未发放前修正：旧SOCSO First Category表偏低 + 4102未含Lindung",
      supersededBy: NEW_FILENAME,
      notes: "工资未发放，安全重做",
    });
  }

  registerPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: NEW_FILENAME,
    status: "active",
    revision: 2,
    driverCount: result.drivers.length,
    notes: "2026官方SOCSO First Category + Lindung入4102 + FOOK Second Category",
  });

  console.log(`\nWrote: ${outPath}`);
  console.log(`Manifest: scripts/_output/payroll-jv/manifest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
