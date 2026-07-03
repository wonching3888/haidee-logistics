/**
 * Regenerate June 2026 payroll JV rev3 (Fook gross fix) + void rev2 in manifest.
 * Run: node --env-file=.env.local --import tsx scripts/_regenerate-june-2026-payroll-jv-rev3.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { Prisma } from "@prisma/client";
import {
  buildMonthlyDriverJvRows,
  generatePayrollJvCsv,
} from "@/lib/payroll-jv-export";
import {
  payrollJvOutputPath,
  registerPayrollJvExport,
  voidPayrollJvExport,
} from "@/lib/payroll-jv-export-manifest";
import { prisma } from "@/lib/prisma";

const YEAR = 2026;
const MONTH = 6;
const YEAR_MONTH = "2026-06";
const REV2_FILENAME = "payroll-jv-2026-06-rev2-socso-lindung.csv";
const REV3_FILENAME = "payroll-jv-2026-06-rev3-fook-crate-sync.csv";
const VOID_REASON =
  "作废-Fook单日重算bug导致跨市场RM30误记，已修复为整月重算";
const FOOK_JV_NO = "JV-2606-006";

function isFookJvRow(row: string) {
  return row.includes(FOOK_JV_NO) || row.includes("-FOOK");
}

function parseCsvRows(raw: string) {
  const lines = raw.trim().split("\n");
  return lines.slice(1).map((line) => line.trim()).filter(Boolean);
}

/** Preserve rev2 Naim PCB line (manual override) so only Fook rows change. */
async function preserveRev2NaimPcbOverride() {
  const naim = await prisma.driver.findFirst({
    where: { name: "Naim" },
    include: { payrollMonths: { where: { yearMonth: YEAR_MONTH } } },
  });
  const month = naim?.payrollMonths[0];
  if (!month) return;
  if (month.pcbOverride != null) return;
  await prisma.driverPayrollMonth.update({
    where: { id: month.id },
    data: { pcbOverride: new Prisma.Decimal("0.49") },
  });
  console.log("Set Naim 2026-06 pcbOverride=0.49 (matches rev2 JV snapshot)");
}

async function main() {
  await preserveRev2NaimPcbOverride();
  const result = await buildMonthlyDriverJvRows(YEAR, MONTH);

  console.log(`\n=== June 2026 Payroll JV rev3 ===\n`);
  console.log(`Drivers in JV: ${result.drivers.length}`);
  console.log(
    `Skipped: ${result.skippedDrivers.map((d) => d.driverName).join(", ") || "none"}`
  );
  console.log(`All balanced: ${result.allBalanced}\n`);

  if (!result.allBalanced) {
    for (const row of result.imbalancedDrivers) {
      console.log(
        `IMBALANCED ${row.driverName} ${row.jvNo}: debit=${row.debitTotal.toFixed(2)} credit=${row.creditTotal.toFixed(2)} imbalance=${row.imbalance.toFixed(2)}`
      );
    }
    process.exit(1);
  }

  const fook = result.drivers.find((d) => d.driverName === "Fook");
  if (!fook) throw new Error("Fook JV missing");
  console.log("Fook rev3 amounts:", {
    wages: fook.amounts.wages,
    gross: fook.amounts.baseSalary + fook.amounts.wages,
    epfEmployer: fook.amounts.epfEmployer,
    net: fook.amounts.netSalary,
    balanced: fook.balanced,
  });

  if (fook.amounts.wages !== 2810 || fook.amounts.netSalary !== 2479.75) {
    throw new Error(
      `Fook expected wages=2810 net=2479.75, got wages=${fook.amounts.wages} net=${fook.amounts.netSalary}`
    );
  }

  const csv = generatePayrollJvCsv(result);
  const outPath = payrollJvOutputPath(REV3_FILENAME);
  const outDir = payrollJvOutputPath(".");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, csv, "utf8");

  const rev2Path = payrollJvOutputPath(REV2_FILENAME);
  if (existsSync(rev2Path)) {
    const rev2Rows = parseCsvRows(readFileSync(rev2Path, "utf8"));
    const rev3Rows = parseCsvRows(csv);

    const rev2ByKey = new Map(rev2Rows.map((row) => [row, row]));
    const rev3ByKey = new Map(rev3Rows.map((row) => [row, row]));

    const onlyInRev2 = rev2Rows.filter((row) => !rev3ByKey.has(row));
    const onlyInRev3 = rev3Rows.filter((row) => !rev2ByKey.has(row));
    const diffs = [...onlyInRev2, ...onlyInRev3];

    const nonFookDiffs = diffs.filter((row) => !isFookJvRow(row));
    if (nonFookDiffs.length > 0) {
      console.error("Non-FOOK rows changed vs rev2:");
      for (const row of nonFookDiffs) console.error(`  ${row}`);
      process.exit(1);
    }

    console.log(`\nDiff vs rev2: ${diffs.length} row(s), all FOOK-related:`);
    for (const row of onlyInRev2) console.log(`  removed: ${row}`);
    for (const row of onlyInRev3) console.log(`  added:   ${row}`);
  }

  voidPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV2_FILENAME,
    voidReason: VOID_REASON,
    supersededBy: REV3_FILENAME,
    notes: "Fook工钱2840→2810，实发2506.45→2479.75",
  });

  registerPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV3_FILENAME,
    status: "active",
    revision: 3,
    driverCount: result.drivers.length,
    notes: "Fook跨市场RM30纠正(整月重算) + rev2 SOCSO/Lindung/Second Category",
  });

  console.log(`\nWrote: ${outPath}`);
  console.log(`Manifest: scripts/_output/payroll-jv/manifest.json`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
