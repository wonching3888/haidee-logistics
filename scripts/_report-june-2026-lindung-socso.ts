/**
 * Report June 2026 driver payroll statutory amounts (Lindung bracket + EIS exempt).
 * Run: node --env-file=.env.local --import tsx scripts/_report-june-2026-lindung-socso.ts
 */
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import { syncFleetPayrollForMonth } from "@/lib/payroll-month-sync";
import type { MaritalStatus } from "@/lib/constants/payroll";

const YEAR = 2026;
const MONTH = 6;
const YEAR_MONTH = "2026-06";

async function main() {
  await syncFleetPayrollForMonth(YEAR, MONTH);

  const drivers = await prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      payrollMonths: {
        where: { yearMonth: YEAR_MONTH },
        include: { trips: true, extras: true },
      },
    },
  });

  const rows: {
    name: string;
    fullName: string | null;
    secondCategory: boolean;
    gross: number;
    socsoEmployee: number;
    socsoEmployer: number;
    lindung24Jam: number;
    epfEmployee: number;
    eisEmployee: number;
    eisEmployer: number;
    pcb: number;
    advance: number;
    netSalary: number;
  }[] = [];

  for (const driver of drivers) {
    const monthRecord = driver.payrollMonths[0];
    const driverInput: DriverPayrollDriverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
      isSocsoSecondCategory: driver.isSocsoSecondCategory,
    };

    const summary = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips: monthRecord?.trips ?? [],
      extras: monthRecord?.extras ?? [],
      overrides: monthRecord,
    });

    rows.push({
      name: driver.name,
      fullName: driver.fullName,
      secondCategory: driver.isSocsoSecondCategory,
      gross: summary.grossSalary,
      socsoEmployee: summary.statutory.socsoEmployee,
      socsoEmployer: summary.statutory.socsoEmployer,
      lindung24Jam: summary.statutory.lindung24Jam,
      epfEmployee: summary.statutory.epfEmployee,
      eisEmployee: summary.statutory.eisEmployee,
      eisEmployer: summary.statutory.eisEmployer,
      pcb: summary.statutory.pcb,
      advance: summary.advanceTotal,
      netSalary: summary.netSalary,
    });
  }

  console.log(`\n=== June 2026 Driver Payroll (Lindung bracket + EIS) — ${rows.length} drivers ===`);
  console.log("Source: PERKESO JadualCarumanBaharuTermasukSKBBK.pdf");
  console.log("       https://www.perkeso.gov.my/images/lindung/lindung-24-jam/JadualCarumanBaharuTermasukSKBBK.pdf");
  console.log("Cross-check: https://payroll.my/payroll-software/socso-contribution-table\n");

  console.log(
    "| Driver | Gross | SOCSO员工 | SOCSO雇主 | Lindung(查表) | EIS员工 | EIS雇主 | 净薪 |"
  );
  console.log("|--------|-------|----------|----------|--------------|---------|---------|------|");
  for (const row of rows) {
    const tag = row.secondCategory ? "*" : "";
    console.log(
      `| ${row.name}${tag} | ${row.gross.toFixed(2)} | ${row.socsoEmployee.toFixed(2)} | ${row.socsoEmployer.toFixed(2)} | ${row.lindung24Jam.toFixed(2)} | ${row.eisEmployee.toFixed(2)} | ${row.eisEmployer.toFixed(2)} | ${row.netSalary.toFixed(2)} |`
    );
  }
  console.log("* = Second Category (60+, EIS exempt)\n");

  const fook = rows.find((r) => r.secondCategory);
  if (fook) {
    const oldLindungPct = Math.round(Math.min(fook.gross, 6000) * 0.0075 * 100) / 100;
    const oldNetWithPctEis = fook.netSalary - (oldLindungPct - fook.lindung24Jam) + 9.08;
    console.log("--- FOOK 修正对照 ---");
    console.log(`  Gross: ${fook.gross.toFixed(2)}`);
    console.log(`  Lindung 旧(0.75%直乘): ${oldLindungPct.toFixed(2)} → 新(官方查表): ${fook.lindung24Jam.toFixed(2)} (差 ${(fook.lindung24Jam - oldLindungPct).toFixed(2)})`);
    console.log(`  EIS员工: 9.08 → ${fook.eisEmployee.toFixed(2)}`);
    console.log(`  净薪 旧(直乘Lindung+EIS): ~${oldNetWithPctEis.toFixed(2)} → 新: ${fook.netSalary.toFixed(2)} (约 +${(fook.netSalary - oldNetWithPctEis).toFixed(2)})`);
    console.log(`  验算: ${fook.gross} - ${fook.epfEmployee} - ${fook.socsoEmployee} - ${fook.lindung24Jam} - ${fook.eisEmployee} - ${fook.pcb} - ${fook.advance} = ${fook.netSalary.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
