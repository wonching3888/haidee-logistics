/**
 * Audit legacy vs official SOCSO First Category + June 2026 JV impact.
 * Run: node --env-file=.env.local --import tsx scripts/_audit-socso-first-category-jv-june-2026.ts
 */
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { SOCSO_BRACKETS } from "@/lib/constants/socso-brackets";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import { buildDriverJvFromSummary } from "@/lib/payroll-jv-export";
import { syncFleetPayrollForMonth } from "@/lib/payroll-month-sync";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { calculateStatutoryDeductions } from "@/lib/payroll-statutory";

/** Pre-2026-07-03 wrong First Category table (systemic ~27-30% low). */
const LEGACY_SOCSO_BRACKETS: {
  wageTo: number;
  employee: number;
  employer: number;
}[] = [
  { wageTo: 30, employee: 0.1, employer: 0.4 },
  { wageTo: 50, employee: 0.2, employer: 0.7 },
  { wageTo: 70, employee: 0.3, employer: 1.0 },
  { wageTo: 100, employee: 0.4, employer: 1.4 },
  { wageTo: 140, employee: 0.55, employer: 1.95 },
  { wageTo: 200, employee: 0.8, employer: 2.8 },
  { wageTo: 300, employee: 1.15, employer: 4.05 },
  { wageTo: 400, employee: 1.5, employer: 5.3 },
  { wageTo: 500, employee: 1.85, employer: 6.55 },
  { wageTo: 600, employee: 2.2, employer: 7.8 },
  { wageTo: 700, employee: 2.55, employer: 9.05 },
  { wageTo: 800, employee: 2.9, employer: 10.3 },
  { wageTo: 900, employee: 3.25, employer: 11.55 },
  { wageTo: 1000, employee: 3.6, employer: 12.8 },
  { wageTo: 1100, employee: 3.95, employer: 14.05 },
  { wageTo: 1200, employee: 4.3, employer: 15.3 },
  { wageTo: 1300, employee: 4.65, employer: 16.55 },
  { wageTo: 1400, employee: 5.0, employer: 17.8 },
  { wageTo: 1500, employee: 5.35, employer: 19.05 },
  { wageTo: 1600, employee: 5.7, employer: 20.3 },
  { wageTo: 1700, employee: 6.05, employer: 21.55 },
  { wageTo: 1800, employee: 6.4, employer: 22.8 },
  { wageTo: 1900, employee: 6.75, employer: 24.05 },
  { wageTo: 2000, employee: 7.1, employer: 25.3 },
  { wageTo: 2100, employee: 7.45, employer: 26.55 },
  { wageTo: 2200, employee: 7.8, employer: 27.8 },
  { wageTo: 2300, employee: 8.15, employer: 29.05 },
  { wageTo: 2400, employee: 8.5, employer: 30.3 },
  { wageTo: 2500, employee: 8.85, employer: 31.55 },
  { wageTo: 2600, employee: 9.2, employer: 32.8 },
  { wageTo: 2700, employee: 9.55, employer: 34.05 },
  { wageTo: 2800, employee: 9.9, employer: 35.3 },
  { wageTo: 2900, employee: 10.25, employer: 36.55 },
  { wageTo: 3000, employee: 10.6, employer: 37.8 },
  { wageTo: 3100, employee: 10.95, employer: 39.05 },
  { wageTo: 3200, employee: 11.3, employer: 40.3 },
  { wageTo: 3300, employee: 11.65, employer: 41.55 },
  { wageTo: 3400, employee: 12.0, employer: 42.8 },
  { wageTo: 3500, employee: 12.35, employer: 44.05 },
  { wageTo: 3600, employee: 12.7, employer: 45.3 },
  { wageTo: 3700, employee: 13.05, employer: 46.55 },
  { wageTo: 3800, employee: 13.4, employer: 47.8 },
  { wageTo: 3900, employee: 13.75, employer: 49.05 },
  { wageTo: 4000, employee: 14.1, employer: 50.3 },
  { wageTo: 4100, employee: 14.45, employer: 51.55 },
  { wageTo: 4200, employee: 14.8, employer: 52.8 },
  { wageTo: 4300, employee: 15.15, employer: 54.05 },
  { wageTo: 4400, employee: 15.5, employer: 55.3 },
  { wageTo: 4500, employee: 15.85, employer: 56.55 },
  { wageTo: 4600, employee: 16.2, employer: 57.8 },
  { wageTo: 4700, employee: 16.55, employer: 59.05 },
  { wageTo: 4800, employee: 16.9, employer: 60.3 },
  { wageTo: 4900, employee: 17.25, employer: 61.55 },
  { wageTo: 5000, employee: 17.6, employer: 62.8 },
  { wageTo: 5100, employee: 17.95, employer: 64.05 },
  { wageTo: 5200, employee: 18.3, employer: 65.3 },
  { wageTo: 5300, employee: 18.65, employer: 66.55 },
  { wageTo: 5400, employee: 19.0, employer: 67.8 },
  { wageTo: 5500, employee: 19.35, employer: 69.05 },
  { wageTo: 5600, employee: 19.7, employer: 70.3 },
  { wageTo: 5700, employee: 20.05, employer: 71.55 },
  { wageTo: 5800, employee: 20.4, employer: 72.8 },
  { wageTo: 5900, employee: 20.75, employer: 74.05 },
  { wageTo: 6000, employee: 29.75, employer: 104.15 },
];

function lookupLegacy(wage: number) {
  const w = Math.min(Math.max(wage, 0), 6000);
  const row =
    LEGACY_SOCSO_BRACKETS.find((r) => w <= r.wageTo) ??
    LEGACY_SOCSO_BRACKETS[LEGACY_SOCSO_BRACKETS.length - 1];
  return { employee: row.employee, employer: row.employer };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.log("\n=== SOCSO First Category: Legacy vs Official (64 brackets + ceiling) ===\n");
  console.log(
    "| # | wageTo | Legacy员工 | Official员工 | Δ员工 | Legacy雇主 | Official雇主 | Δ雇主 |"
  );
  console.log("|--:|-------:|-----------:|-------------:|------:|-----------:|-------------:|------:|");

  let mismatchCount = 0;
  for (let i = 0; i < SOCSO_BRACKETS.length; i++) {
    const official = SOCSO_BRACKETS[i];
    const legacy = LEGACY_SOCSO_BRACKETS[i];
    const de = round2(official.employee - legacy.employee);
    const dm = round2(official.employer - legacy.employer);
    const flag =
      official.employee !== legacy.employee || official.employer !== legacy.employer
        ? "≠"
        : "=";
    if (flag === "≠") mismatchCount++;
    console.log(
      `| ${i + 1} | ${official.wageTo} | ${legacy.employee.toFixed(2)} | ${official.employee.toFixed(2)} | ${de >= 0 ? "+" : ""}${de.toFixed(2)} | ${legacy.employer.toFixed(2)} | ${official.employer.toFixed(2)} | ${dm >= 0 ? "+" : ""}${dm.toFixed(2)} ${flag} |`
    );
  }
  console.log(`\n不一致档位数: ${mismatchCount} / ${SOCSO_BRACKETS.length} (仅第64档6000在旧表已修正过，其余63档全错)\n`);

  console.log("=== JV 共用确认 ===");
  console.log(
    "lookupSocsoContributions (lib/constants/socso-brackets.ts) 被以下模块共用:"
  );
  console.log("  - lib/payroll-statutory.ts → 司机月薪/净薪");
  console.log("  - lib/payroll-jv-export.ts → buildDriverPayrollSummaryFromRecords → JV 4102/9006/实发");
  console.log("JV 无独立存储，导出时实时计算。已导出六月 CSV 使用的是旧表数值。\n");

  await syncFleetPayrollForMonth(2026, 6);
  const drivers = await prisma.driver.findMany({
    orderBy: { name: "asc" },
    include: {
      payrollMonths: {
        where: { yearMonth: "2026-06" },
        include: { trips: true, extras: true },
      },
    },
  });

  console.log("=== June 2026 JV SOCSO 差额 (13 active JV drivers, 排除 Din inactive) ===\n");
  console.log(
    "| Driver | Gross | JV? | 旧SOCSO员工 | 新SOCSO员工 | Δ员工 | 旧SOCSO雇主 | 新SOCSO雇主 | Δ雇主 | 旧4102 SOCSO+EIS | 新4102 | Δ4102 | 旧实发JV | 新实发 | Δ净薪 |"
  );
  console.log("|--------|------:|:---:|------------:|------------:|------:|------------:|------------:|------:|-----------------:|-------:|------:|---------:|-------:|------:|");

  let totalDeltaEmployee = 0;
  let totalDeltaEmployer = 0;
  let totalDelta4102 = 0;
  let totalDeltaNet = 0;
  let jvCount = 0;

  for (const driver of drivers) {
    if (driver.name === "Din") continue;

    const monthRecord = driver.payrollMonths[0];
    const driverInput: DriverPayrollDriverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
      isSocsoSecondCategory: driver.isSocsoSecondCategory,
    };

    const overrides = monthRecord;
    const newSummary = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips: monthRecord?.trips ?? [],
      extras: monthRecord?.extras ?? [],
      overrides,
    });

    const gross = newSummary.grossSalary;
    const hasJv = Boolean(driver.accountCodeSuffix?.trim()) && driver.active;

    let oldSocsoEmp: number;
    let oldSocsoMaj: number;
    if (driver.isSocsoSecondCategory) {
      oldSocsoEmp = decimalToNumber(overrides?.socsoEmployeeOverride) ?? 0;
      oldSocsoMaj =
        decimalToNumber(overrides?.socsoEmployerOverride) ??
        lookupLegacy(gross).employer;
    } else {
      const leg = lookupLegacy(gross);
      oldSocsoEmp = decimalToNumber(overrides?.socsoEmployeeOverride) ?? leg.employee;
      oldSocsoMaj = decimalToNumber(overrides?.socsoEmployerOverride) ?? leg.employer;
    }

    const newSocsoEmp = newSummary.statutory.socsoEmployee;
    const newSocsoMaj = newSummary.statutory.socsoEmployer;
    const eisEmp = newSummary.statutory.eisEmployee;
    const eisMaj = newSummary.statutory.eisEmployer;

    const old4102 = round2(oldSocsoEmp + eisEmp + oldSocsoMaj + eisMaj);
    const new4102 = round2(newSocsoEmp + eisEmp + newSocsoMaj + eisMaj);
    const dEmp = round2(newSocsoEmp - oldSocsoEmp);
    const dMaj = round2(newSocsoMaj - oldSocsoMaj);
    const d4102 = round2(new4102 - old4102);

    const oldNet = round2(
      Math.max(
        0,
        gross -
          newSummary.statutory.epfEmployee -
          oldSocsoEmp -
          newSummary.statutory.lindung24Jam -
          eisEmp -
          newSummary.statutory.pcb -
          newSummary.advanceTotal
      )
    );
    const newNet = newSummary.netSalary;
    const dNet = round2(newNet - oldNet);

    if (hasJv && driver.active) {
      jvCount++;
      totalDeltaEmployee += dEmp;
      totalDeltaEmployer += dMaj;
      totalDelta4102 += d4102;
      totalDeltaNet += dNet;
    }

    const jvTag = hasJv && driver.active ? "Y" : driver.isSocsoSecondCategory ? "FOOK" : "N";

    console.log(
      `| ${driver.name} | ${gross.toFixed(2)} | ${jvTag} | ${oldSocsoEmp.toFixed(2)} | ${newSocsoEmp.toFixed(2)} | ${dEmp >= 0 ? "+" : ""}${dEmp.toFixed(2)} | ${oldSocsoMaj.toFixed(2)} | ${newSocsoMaj.toFixed(2)} | ${dMaj >= 0 ? "+" : ""}${dMaj.toFixed(2)} | ${old4102.toFixed(2)} | ${new4102.toFixed(2)} | ${d4102 >= 0 ? "+" : ""}${d4102.toFixed(2)} | ${oldNet.toFixed(2)} | ${newNet.toFixed(2)} | ${dNet >= 0 ? "+" : ""}${dNet.toFixed(2)} |`
    );
  }

  console.log(
    `\n13份JV合计差额: ΔSOCSO员工 ${totalDeltaEmployee >= 0 ? "+" : ""}${totalDeltaEmployee.toFixed(2)} | ΔSOCSO雇主 ${totalDeltaEmployer >= 0 ? "+" : ""}${totalDeltaEmployer.toFixed(2)} | Δ4102应付 ${totalDelta4102 >= 0 ? "+" : ""}${totalDelta4102.toFixed(2)} | Δ实发 ${totalDeltaNet >= 0 ? "+" : ""}${totalDeltaNet.toFixed(2)}`
  );
  console.log(`(JV driver count: ${jvCount})\n`);

  console.log("=== 修正后 14人 6月完整对照 ===\n");
  console.log(
    "| Driver | Gross | SOCSO员工 | SOCSO雇主 | Lindung | EIS员工 | EIS雇主 | 净薪 |"
  );
  console.log("|--------|------:|----------:|----------:|--------:|--------:|--------:|-----:|");

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
    const s = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips: monthRecord?.trips ?? [],
      extras: monthRecord?.extras ?? [],
      overrides: monthRecord,
    });
    console.log(
      `| ${driver.name}${driver.isSocsoSecondCategory ? "*" : ""} | ${s.grossSalary.toFixed(2)} | ${s.statutory.socsoEmployee.toFixed(2)} | ${s.statutory.socsoEmployer.toFixed(2)} | ${s.statutory.lindung24Jam.toFixed(2)} | ${s.statutory.eisEmployee.toFixed(2)} | ${s.statutory.eisEmployer.toFixed(2)} | ${s.netSalary.toFixed(2)} |`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
