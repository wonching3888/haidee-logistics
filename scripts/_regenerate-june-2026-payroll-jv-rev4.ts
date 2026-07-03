/**
 * Regenerate June 2026 payroll JV rev4 (Fook crate fix + Naim PCB=0 after override clear).
 * Run: node --env-file=.env.local --import tsx scripts/_regenerate-june-2026-payroll-jv-rev4.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import {
  buildMonthlyDriverJvRows,
  generatePayrollJvCsv,
} from "@/lib/payroll-jv-export";
import {
  payrollJvOutputPath,
  readPayrollJvManifest,
  registerPayrollJvExport,
  voidPayrollJvExport,
} from "@/lib/payroll-jv-export-manifest";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";

const YEAR = 2026;
const MONTH = 6;
const YEAR_MONTH = "2026-06";
const REV2_FILENAME = "payroll-jv-2026-06-rev2-socso-lindung.csv";
const REV3_FILENAME = "payroll-jv-2026-06-rev3-fook-crate-sync.csv";
const REV4_FILENAME = "payroll-jv-2026-06-rev4-fook-pcb-fix.csv";
const REV2_VOID_REASON =
  "作废-Fook单日重算bug导致跨市场RM30误记，已修复为整月重算";
const REV3_VOID_REASON =
  "生成脚本误将JV快照值(0.49)直接写入生产库pcbOverride字段，绕过审计日志，构成数据污染，已清除并重新生成rev4";
const FOOK_JV_NO = "JV-2606-006";
const NAIM_JV_NO = "JV-2606-009";

function parseCsvRows(raw: string) {
  const lines = raw.trim().split("\n");
  return lines.slice(1).map((line) => line.trim()).filter(Boolean);
}

function isExpectedDiffRow(row: string) {
  return (
    row.includes(FOOK_JV_NO) ||
    row.includes("-FOOK") ||
    row.includes(NAIM_JV_NO) ||
    row.includes("-NAIM") ||
    row.includes("Mohamad Naim")
  );
}

async function main() {
  const naimMonth = await prisma.driverPayrollMonth.findFirst({
    where: { driver: { name: "Naim" }, yearMonth: YEAR_MONTH },
    select: { pcbOverride: true },
  });
  if (decimalToNumber(naimMonth?.pcbOverride ?? null) != null) {
    throw new Error(
      "Naim June pcbOverride must be null before rev4. Run scripts/_clear-naim-pcb-override-june-2026.ts first."
    );
  }

  const result = await buildMonthlyDriverJvRows(YEAR, MONTH);

  console.log(`\n=== June 2026 Payroll JV rev4 ===\n`);
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

  console.log("| JVNo | Driver | Debit | Credit | Balanced |");
  console.log("|------|--------|------:|-------:|:--------:|");
  for (const jv of result.drivers) {
    console.log(
      `| ${jv.jvNo} | ${jv.driverName} | ${jv.debitTotal.toFixed(2)} | ${jv.creditTotal.toFixed(2)} | ${jv.balanced ? "OK" : "FAIL"} |`
    );
  }

  const fook = result.drivers.find((d) => d.driverName === "Fook");
  const naim = result.drivers.find((d) => d.driverName === "Naim");
  if (!fook || !naim) throw new Error("Fook or Naim JV missing");

  console.log("\nFook rev4:", {
    wages: fook.amounts.wages,
    gross: fook.amounts.baseSalary + fook.amounts.wages,
    net: fook.amounts.netSalary,
    pcb: fook.amounts.pcb,
    balanced: fook.balanced,
  });
  console.log("Naim rev4:", {
    wages: naim.amounts.wages,
    net: naim.amounts.netSalary,
    pcb: naim.amounts.pcb,
    balanced: naim.balanced,
  });

  if (fook.amounts.wages !== 2810 || fook.amounts.netSalary !== 2479.75) {
    throw new Error(`Fook amounts mismatch: ${JSON.stringify(fook.amounts)}`);
  }
  if (naim.amounts.pcb !== 0 || naim.amounts.netSalary !== 2228.44) {
    throw new Error(`Naim amounts mismatch: ${JSON.stringify(naim.amounts)}`);
  }

  const csv = generatePayrollJvCsv(result);
  const outPath = payrollJvOutputPath(REV4_FILENAME);
  const outDir = payrollJvOutputPath(".");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, csv, "utf8");

  const rev2Path = payrollJvOutputPath(REV2_FILENAME);
  if (existsSync(rev2Path)) {
    const rev2Rows = parseCsvRows(readFileSync(rev2Path, "utf8"));
    const rev4Rows = parseCsvRows(csv);
    const rev2ByKey = new Map(rev2Rows.map((row) => [row, row]));
    const rev4ByKey = new Map(rev4Rows.map((row) => [row, row]));
    const onlyInRev2 = rev2Rows.filter((row) => !rev4ByKey.has(row));
    const onlyInRev4 = rev4Rows.filter((row) => !rev2ByKey.has(row));
    const diffs = [...onlyInRev2, ...onlyInRev4];
    const unexpected = diffs.filter((row) => !isExpectedDiffRow(row));
    if (unexpected.length > 0) {
      console.error("Unexpected diffs vs rev2 (beyond Fook + Naim):");
      for (const row of unexpected) console.error(`  ${row}`);
      process.exit(1);
    }
    console.log(`\nDiff vs rev2: ${diffs.length} row(s) (Fook + Naim only):`);
    for (const row of onlyInRev2) console.log(`  removed: ${row}`);
    for (const row of onlyInRev4) console.log(`  added:   ${row}`);
  }

  const manifest = readPayrollJvManifest();
  const rev2Entry = manifest.entries.find((e) => e.filename === REV2_FILENAME);
  if (rev2Entry && rev2Entry.status === "active") {
    voidPayrollJvExport({
      yearMonth: YEAR_MONTH,
      filename: REV2_FILENAME,
      voidReason: REV2_VOID_REASON,
      supersededBy: REV4_FILENAME,
    });
  }

  voidPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV3_FILENAME,
    voidReason: REV3_VOID_REASON,
    supersededBy: REV4_FILENAME,
    notes: "Fook工钱纠正 + 清除误写pcbOverride后Naim PCB=0",
  });

  registerPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV4_FILENAME,
    status: "active",
    revision: 4,
    driverCount: result.drivers.length,
    notes:
      "Fook整月crate重算(4510/2479.75) + Naim PCB手动策略下为0(净额2228.44)",
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
