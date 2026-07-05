/**
 * DRY-RUN preview: Din termination + baseSalary 550 + June rev7 JV + payslip.
 * Does NOT write DB, manifest, or CSV files.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_preview-din-termination-rev7.ts
 */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { DriverPayslipPrint } from "@/components/driver-payroll/DriverPayslipPrint";
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import { payslipBalanceBeforeAdvance, payslipWagesTotal } from "@/lib/driver-payslip";
import {
  isDriverEligibleForPayrollMonth,
  payrollEligibilitySkipReason,
} from "@/lib/driver-payroll-eligibility";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import {
  buildDriverJvFromSummary,
  generatePayrollJvCsv,
  type MonthlyPayrollJvResult,
} from "@/lib/payroll-jv-export";
import { payrollJvOutputPath } from "@/lib/payroll-jv-export-manifest";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { prisma } from "@/lib/prisma";

const YEAR = 2026;
const MONTH = 6;
const YEAR_MONTH = "2026-06";
const REV6_FILENAME = "payroll-jv-2026-06-rev6-epf-brackets.csv";
const REV7_FILENAME = "payroll-jv-2026-06-rev7-din-termination.csv";
const PROPOSED_BASE_SALARY = 550;
const PROPOSED_TERMINATION = new Date("2026-06-10T00:00:00.000Z");
const OUT = path.join(process.cwd(), "scripts/_output");

function parseCsvRows(raw: string) {
  return raw.trim().split("\n").slice(1).map((line) => line.trim()).filter(Boolean);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function buildDinJuneSummary(
  din: {
    id: string;
    name: string;
    maritalStatus: string | null;
    childCount: number;
    isSocsoSecondCategory: boolean;
  },
  monthRecord: {
    trips: Parameters<typeof buildDriverPayrollSummaryFromRecords>[0]["trips"];
    extras: Parameters<typeof buildDriverPayrollSummaryFromRecords>[0]["extras"];
    epfEmployeeOverride: unknown;
    epfEmployerOverride: unknown;
    socsoEmployeeOverride: unknown;
    socsoEmployerOverride: unknown;
    eisEmployeeOverride: unknown;
    eisEmployerOverride: unknown;
    pcbOverride: unknown;
    lindung24JamOverride: unknown;
  },
  baseSalary: number
) {
  const driverInput: DriverPayrollDriverInput = {
    id: din.id,
    name: din.name,
    baseSalary,
    maritalStatus: din.maritalStatus as MaritalStatus | null,
    childCount: din.childCount,
    isSocsoSecondCategory: din.isSocsoSecondCategory,
  };
  return buildDriverPayrollSummaryFromRecords({
    driver: driverInput,
    trips: monthRecord.trips,
    extras: monthRecord.extras,
    overrides: monthRecord,
  });
}

function printSummaryBlock(label: string, summary: ReturnType<typeof buildDinJuneSummary>) {
  const wages = payslipWagesTotal(summary);
  const balance = payslipBalanceBeforeAdvance(summary);
  const epfOfficial = lookupEpfContributions(summary.grossSalary);
  console.log(`\n=== ${label} ===`);
  console.log({
    baseSalary: summary.baseSalary,
    tripAllowanceTotal: summary.tripAllowanceTotal,
    extraAllowanceTotal: summary.extraAllowanceTotal,
    crateCommissionTotal: summary.crateCommissionTotal,
    crateMultiMarketTotal: summary.crateMultiMarketTotal,
    wages,
    grossSalary: summary.grossSalary,
    epfEmployer: summary.statutory.epfEmployer,
    epfEmployee: summary.statutory.epfEmployee,
    epfOfficialTable: epfOfficial,
    socsoEmployer: summary.statutory.socsoEmployer,
    socsoEmployee: summary.statutory.socsoEmployee,
    eisEmployer: summary.statutory.eisEmployer,
    eisEmployee: summary.statutory.eisEmployee,
    lindung24Jam: summary.statutory.lindung24Jam,
    pcb: summary.statutory.pcb,
    advanceTotal: summary.advanceTotal,
    balanceBeforeAdvance: balance,
    netSalary: summary.netSalary,
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const [dinRow] = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      full_name: string | null;
      active: boolean;
      base_salary: unknown;
      ic_number: string | null;
      bank_name: string | null;
      bank_account: string | null;
      account_code_suffix: string | null;
      marital_status: string | null;
      child_count: number;
      is_socso_second_category: boolean;
    }>
  >`
    SELECT id, name, full_name, active, base_salary, ic_number, bank_name,
           bank_account, account_code_suffix, marital_status, child_count,
           is_socso_second_category
    FROM drivers
    WHERE name = 'Din'
    LIMIT 1
  `;
  if (!dinRow) throw new Error("Din not found");

  const payrollMonths = await prisma.driverPayrollMonth.findMany({
    where: {
      driverId: dinRow.id,
      yearMonth: { in: ["2026-06", "2026-07"] },
    },
    include: { trips: true, extras: true },
    orderBy: { yearMonth: "asc" },
  });

  const din = {
    id: dinRow.id,
    name: dinRow.name,
    fullName: dinRow.full_name,
    active: dinRow.active,
    baseSalary: dinRow.base_salary,
    icNumber: dinRow.ic_number,
    bankName: dinRow.bank_name,
    bankAccount: dinRow.bank_account,
    accountCodeSuffix: dinRow.account_code_suffix,
    maritalStatus: dinRow.marital_status,
    childCount: dinRow.child_count,
    isSocsoSecondCategory: dinRow.is_socso_second_category,
    payrollMonths,
  };

  const juneRecord = din.payrollMonths.find((m) => m.yearMonth === "2026-06");
  const julyRecord = din.payrollMonths.find((m) => m.yearMonth === "2026-07");
  if (!juneRecord) throw new Error("Din June payroll month missing");

  console.log("========== PROPOSED DB CHANGES (NOT APPLIED) ==========");
  console.log({
    driver: "Din",
    baseSalary: `${decimalToNumber(din.baseSalary)} → ${PROPOSED_BASE_SALARY}`,
    terminationDate: `null → ${PROPOSED_TERMINATION.toISOString().slice(0, 10)}`,
    active: `${din.active} → true (unchanged)`,
  });

  console.log("\n========== ELIGIBILITY (proposed terminationDate) ==========");
  const proposedDriver = {
    active: true,
    terminationDate: PROPOSED_TERMINATION,
    name: "Din",
  };
  for (const [y, m, label] of [
    [2026, 6, "June 2026"],
    [2026, 7, "July 2026"],
  ] as const) {
    console.log({
      month: label,
      eligible: isDriverEligibleForPayrollMonth(proposedDriver, y, m),
      skipReason: payrollEligibilitySkipReason(proposedDriver, y, m),
    });
  }

  console.log("\n========== JULY GHOST RECORD (proposed delete) ==========");
  if (julyRecord) {
    const julySummary = buildDinJuneSummary(
      din,
      julyRecord,
      decimalToNumber(din.baseSalary) ?? 0
    );
    console.log({
      payrollMonthId: julyRecord.id,
      yearMonth: julyRecord.yearMonth,
      trips: julyRecord.trips.length,
      extras: julyRecord.extras.length,
      gross: julySummary.grossSalary,
      action: "DELETE (post-termination auto-sync artifact)",
    });
  } else {
    console.log("No 2026-07 record found.");
  }

  const currentBase = decimalToNumber(din.baseSalary) ?? 0;
  const currentSummary = buildDinJuneSummary(din, juneRecord, currentBase);
  const proposedSummary = buildDinJuneSummary(
    din,
    juneRecord,
    PROPOSED_BASE_SALARY
  );

  printSummaryBlock("Din June CURRENT (base 510)", currentSummary);
  printSummaryBlock("Din June PROPOSED (base 550)", proposedSummary);

  const dinJv = buildDriverJvFromSummary({
    driver: {
      id: din.id,
      name: din.name,
      fullName: din.fullName,
      accountCodeSuffix: din.accountCodeSuffix ?? "DIN1",
    },
    summary: proposedSummary,
    jvNo: "JV-2606-014",
    jvDate: "2026-06-30",
  });

  console.log("\n=== Din June JV-2606-014 (proposed append to rev6) ===");
  console.log({
    jvNo: dinJv.jvNo,
    balanced: dinJv.balanced,
    debitTotal: dinJv.debitTotal,
    creditTotal: dinJv.creditTotal,
    imbalance: dinJv.imbalance,
    amounts: dinJv.amounts,
  });
  console.log("Lines:");
  for (const line of dinJv.lines) {
    console.log(
      `  ${line.accountCode} Dr=${line.debit || ""} Cr=${line.credit || ""} | ${line.description}`
    );
  }

  const rev6Path = payrollJvOutputPath(REV6_FILENAME);
  if (!fs.existsSync(rev6Path)) {
    throw new Error(`rev6 not found: ${rev6Path}`);
  }
  const rev6Rows = parseCsvRows(fs.readFileSync(rev6Path, "utf8"));
  const rev7Rows = [...rev6Rows, ...dinJv.lines.map((line) =>
    [
      line.date,
      line.jvNo,
      line.accountCode,
      line.debit > 0 ? line.debit.toFixed(2) : "",
      line.credit > 0 ? line.credit.toFixed(2) : "",
      line.description,
    ].join(",")
  )];

  console.log("\n=== rev7 vs rev6 diff preview ==========");
  console.log({
    rev6Rows: rev6Rows.length,
    dinJvLines: dinJv.lines.length,
    rev7Rows: rev7Rows.length,
    rev7Filename: REV7_FILENAME,
  });

  const rev6Set = new Set(rev6Rows);
  const rev7Set = new Set(rev7Rows);
  const onlyRev7 = rev7Rows.filter((r) => !rev6Set.has(r));
  const onlyRev6 = rev6Rows.filter((r) => !rev7Set.has(r));

  console.log(`Only in rev7 (+${onlyRev7.length} rows, expect ${dinJv.lines.length}):`);
  for (const row of onlyRev7) console.log(`  + ${row}`);
  console.log(`Only in rev6 (-${onlyRev6.length} rows, expect 0):`);
  for (const row of onlyRev6) console.log(`  - ${row}`);

  if (onlyRev6.length > 0) {
    throw new Error("rev7 would change existing rev6 rows — abort preview");
  }

  if (!dinJv.balanced) {
    console.log("\n⚠️  JV IMBALANCE WARNING");
    console.log(
      `Advance (${proposedSummary.advanceTotal}) exceeds balance before advance (${payslipBalanceBeforeAdvance(proposedSummary)}).`
    );
    console.log(
      `Net pay clamps to 0; current JV template credits full advance without a receivable line — imbalance ${dinJv.imbalance}.`
    );
    console.log(
      "Accounting must confirm treatment before rev7 write (e.g. cap advance credit, or add employee receivable)."
    );
  } else {
    const rev7Result: MonthlyPayrollJvResult = {
      year: YEAR,
      month: MONTH,
      yearMonth: YEAR_MONTH,
      jvDate: "2026-06-30",
      drivers: [dinJv],
      skippedDrivers: [],
      imbalancedDrivers: [],
      allBalanced: true,
      flatLines: dinJv.lines,
    };
    generatePayrollJvCsv(rev7Result);
    console.log("Din JV lines pass balance check.");
  }

  const advances = juneRecord.extras
    .filter((e) => e.type === "advance")
    .map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      amount: decimalToNumber(e.amount) ?? 0,
      note: e.note,
    }));

  const payslipHtmlPath = path.join(OUT, "payslip-din-june-2026-rev7-preview.html");
  const payslipPngPath = path.join(OUT, "payslip-din-june-2026-rev7-preview.png");
  const css = fs.readFileSync(
    path.join(process.cwd(), "components/driver-payroll/driver-payslip-print.css"),
    "utf8"
  );
  const body = renderToStaticMarkup(
    React.createElement(DriverPayslipPrint, {
      year: YEAR,
      month: MONTH,
      driver: {
        payrollName: din.fullName?.trim() || din.name,
        name: din.name,
        icNumber: din.icNumber,
        baseSalary: PROPOSED_BASE_SALARY,
        bankName: din.bankName,
        bankAccount: din.bankAccount,
      },
      summary: proposedSummary,
      advances,
    })
  );
  fs.writeFileSync(
    payslipHtmlPath,
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${body}</body></html>`,
    "utf8"
  );
  console.log("\n=== Payslip preview (proposed base 550) ===");
  console.log("HTML:", payslipHtmlPath);

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.goto(`file:///${payslipHtmlPath.replace(/\\/g, "/")}`, {
      waitUntil: "load",
    });
    await page.locator(".driver-payslip-print").screenshot({ path: payslipPngPath });
    await browser.close();
    console.log("PNG:", payslipPngPath);
  } catch (e) {
    console.log("PNG: skipped (Playwright unavailable)", e instanceof Error ? e.message : e);
  }

  console.log("\n========== SUMMARY FOR USER CONFIRMATION ==========");
  console.log("1. Apply schema migration termination_date");
  console.log("2. UPDATE Din: baseSalary=550, terminationDate=2026-06-10, active=true");
  console.log("3. DELETE Din payroll month 2026-07");
  console.log("4. Register rev7 CSV (rev6 rows unchanged + Din JV-2606-014)");
  console.log("5. NO DB write performed in this preview run");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
