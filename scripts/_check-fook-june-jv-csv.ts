/**
 * Reconstruct FOOK June JV 9006/4102 as exported under OLD vs NEW logic.
 * Run: node --env-file=.env.local --import tsx scripts/_check-fook-june-jv-csv.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import { buildDriverJvFromSummary } from "@/lib/payroll-jv-export";
import { lookupSocsoContributions } from "@/lib/constants/socso-brackets";
import type { MaritalStatus } from "@/lib/constants/payroll";
import type { PayrollSummary } from "@/lib/payroll-statutory";
import { payrollJvOutputPath } from "@/lib/payroll-jv-export-manifest";

/** Pre-fix JV export: no isSocsoSecondCategory, no Lindung in 4102, legacy SOCSO below. */
const LEGACY_SOCSO_AT_4540 = lookupSocsoContributions(4540); // wrong if used before table fix — use explicit legacy
const LEGACY_EMP_4540 = 16.2;
const LEGACY_MAJ_4540 = 57.8;

function lineAmount(lines: { accountCode: string; debit: number; credit: number }[], codePrefix: string, side: "debit" | "credit") {
  const line = lines.find((l) =>
    codePrefix === "4102" ? l.accountCode === "4102-0000" : l.accountCode.startsWith(codePrefix)
  );
  if (!line) return 0;
  return side === "debit" ? line.debit : line.credit;
}

async function main() {
  const csvPath = payrollJvOutputPath("payroll-jv-2026-06.csv");
  console.log("\n=== FOOK June JV 9006/4102 核对 ===\n");

  if (existsSync(csvPath)) {
    const raw = readFileSync(csvPath, "utf8");
    const fookLines = raw.split("\n").filter((row) => /FOOK|Yong Ah Fook/i.test(row));
    console.log(`找到原始CSV: ${csvPath}`);
    console.log(`FOOK相关行数: ${fookLines.length}`);
    for (const row of fookLines) {
      if (/9006-FOOK|4102-0000/.test(row)) console.log(`  ${row}`);
    }
    const m9006 = fookLines.find((r) => r.includes("9006-FOOK"));
    const m4102 = fookLines.find((r) => r.includes("4102-0000") && r.includes("FOOK"));
    if (m9006 || m4102) {
      const parseAmt = (row: string | undefined, idx: number) => {
        if (!row) return null;
        const cols = row.split(",");
        const val = cols[idx]?.trim();
        return val ? Number(val) : null;
      };
      console.log("\n原始CSV解析:");
      console.log(`  9006-FOOK 借方: ${parseAmt(m9006, 3) ?? "—"}`);
      console.log(`  4102-0000 贷方(FOOK行): ${parseAmt(m4102, 4) ?? "—"}`);
    }
  } else {
    console.log(`未找到原始CSV (${csvPath})，改按旧导出逻辑重建对比。\n`);
  }

  const driver = await prisma.driver.findFirst({
    where: { name: "Fook" },
    include: {
      payrollMonths: {
        where: { yearMonth: "2026-06" },
        include: { trips: true, extras: true },
      },
    },
  });
  if (!driver) throw new Error("Fook not found");

  const monthRecord = driver.payrollMonths[0];
  const driverInput: DriverPayrollDriverInput = {
    id: driver.id,
    name: driver.name,
    baseSalary: decimalToNumber(driver.baseSalary),
    maritalStatus: driver.maritalStatus as MaritalStatus | null,
    childCount: driver.childCount,
    isSocsoSecondCategory: true,
  };

  const correctSummary = buildDriverPayrollSummaryFromRecords({
    driver: driverInput,
    trips: monthRecord?.trips ?? [],
    extras: monthRecord?.extras ?? [],
    overrides: monthRecord,
  });

  const wrongFirstCatSummary: PayrollSummary = {
    ...correctSummary,
    statutory: {
      ...correctSummary.statutory,
      socsoEmployee: LEGACY_EMP_4540,
      socsoEmployer: LEGACY_MAJ_4540,
      eisEmployee: 9.08,
      eisEmployer: 9.08,
    },
    netSalary:
      correctSummary.grossSalary -
      correctSummary.statutory.epfEmployee -
      LEGACY_EMP_4540 -
      correctSummary.statutory.lindung24Jam -
      9.08 -
      correctSummary.statutory.pcb -
      correctSummary.advanceTotal,
  };

  const wrongOfficialFirstCat: PayrollSummary = {
    ...correctSummary,
    statutory: {
      ...correctSummary.statutory,
      socsoEmployee: 22.75,
      socsoEmployer: 79.65,
      eisEmployee: 9.08,
      eisEmployer: 9.08,
    },
    netSalary:
      correctSummary.grossSalary -
      correctSummary.statutory.epfEmployee -
      22.75 -
      correctSummary.statutory.lindung24Jam -
      9.08 -
      correctSummary.statutory.pcb -
      correctSummary.advanceTotal,
  };

  function buildJv(summary: PayrollSummary, label: string) {
    const jv = buildDriverJvFromSummary({
      driver: {
        id: driver.id,
        name: driver.name,
        fullName: driver.fullName,
        accountCodeSuffix: "FOOK",
      },
      summary,
      jvNo: "JV-2606-FOOK",
      jvDate: "2026-06-30",
    });
    const oldStyle4102 =
      summary.statutory.socsoEmployee +
      summary.statutory.eisEmployee +
      summary.statutory.socsoEmployer +
      summary.statutory.eisEmployer;
    return {
      label,
      socsoEmp: summary.statutory.socsoEmployee,
      socsoMaj: summary.statutory.socsoEmployer,
      eisEmp: summary.statutory.eisEmployee,
      debit9006: lineAmount(jv.lines, "9006", "debit"),
      credit4102New: jv.amounts.socsoEisLindungPayable,
      credit4102OldStyle: Math.round(oldStyle4102 * 100) / 100,
      balanced: jv.balanced,
    };
  }

  const scenarios = [
    buildJv(correctSummary, "正确 Second Category + Lindung入4102"),
    {
      ...buildJv(wrongFirstCatSummary, "误用 First Category(旧表) + 无SecondCategory标记"),
      credit4102New: wrongFirstCatSummary.statutory.socsoEmployee +
        wrongFirstCatSummary.statutory.eisEmployee +
        wrongFirstCatSummary.statutory.socsoEmployer +
        wrongFirstCatSummary.statutory.eisEmployer,
    },
    {
      label: "误用 First Category(2026官方档22.75/79.65) + EIS",
      socsoEmp: 22.75,
      socsoMaj: 79.65,
      eisEmp: 9.08,
      debit9006: Math.round((79.65 + 9.08) * 100) / 100,
      credit4102OldStyle: Math.round((22.75 + 9.08 + 79.65 + 9.08) * 100) / 100,
      credit4102New: Math.round((22.75 + 9.08 + 79.65 + 9.08) * 100) / 100,
      balanced: false,
    },
    {
      label: "正确 Second Category 仅SOCSO+EIS(无Lindung旧JV)",
      socsoEmp: 0,
      socsoMaj: 56.9,
      eisEmp: 0,
      debit9006: 56.9,
      credit4102OldStyle: 56.9,
      credit4102New: 56.9 + correctSummary.statutory.lindung24Jam,
      balanced: false,
    },
  ];

  console.log("场景重建对比:\n");
  console.log("| 场景 | SOCSO员工 | SOCSO雇主 | 9006借 | 4102贷(旧式无Lindung) | 4102贷(含Lindung) |");
  console.log("|------|----------:|----------:|-------:|---------------------:|------------------:|");
  for (const s of scenarios) {
    console.log(
      `| ${s.label} | ${s.socsoEmp.toFixed(2)} | ${s.socsoMaj.toFixed(2)} | ${s.debit9006.toFixed(2)} | ${s.credit4102OldStyle.toFixed(2)} | ${s.credit4102New.toFixed(2)} |`
    );
  }

  console.log("\n结论判定:");
  console.log("  若原JV 9006≈56.90 且 4102≈56.90(无Lindung) → Second Category正确，仅需rev2加Lindung+SOCSO表修正(其他司机)");
  console.log("  若原JV 9006≈88.73 且 4102含员工22.75 → First Category误算，FOOK需重做");
  console.log(`\n当前正确值( rev2 ): 9006借=${buildJv(correctSummary, "").debit9006.toFixed(2)}, 4102贷=${buildJv(correctSummary, "").credit4102New.toFixed(2)} (含Lindung ${correctSummary.statutory.lindung24Jam.toFixed(2)})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
