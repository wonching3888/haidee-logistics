/**
 * Apply Din termination + baseSalary 550 + rev7 JV + payslip.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_apply-din-termination-rev7.ts
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { DriverPayslipPrint } from "@/components/driver-payroll/DriverPayslipPrint";
import { SHARED_PAYROLL_JV_ACCOUNTS } from "@/lib/constants/payroll-jv-accounts";
import {
  payslipAdvanceRecoveredFromPay,
  payslipAdvanceWriteOff,
  payslipBalanceBeforeAdvance,
  payslipWagesTotal,
} from "@/lib/driver-payslip";
import {
  isDriverEligibleForPayrollMonth,
} from "@/lib/driver-payroll-eligibility";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import {
  buildDriverJvFromSummary,
  generatePayrollJvCsv,
} from "@/lib/payroll-jv-export";
import {
  payrollJvOutputPath,
  readPayrollJvManifest,
  registerPayrollJvExport,
  voidPayrollJvExport,
} from "@/lib/payroll-jv-export-manifest";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { prisma } from "@/lib/prisma";

const YEAR = 2026;
const MONTH = 6;
const YEAR_MONTH = "2026-06";
const REV6_FILENAME = "payroll-jv-2026-06-rev6-epf-brackets.csv";
const REV7_FILENAME = "payroll-jv-2026-06-rev7-din-termination.csv";
const REV6_VOID_REASON = "补充Din离职月数据+底薪修正，替换为rev7";
const PROPOSED_BASE = 550;
const PROPOSED_TERMINATION = new Date("2026-06-10T00:00:00.000Z");
const OUT = path.join(process.cwd(), "scripts/_output");

function parseCsvRows(raw: string) {
  return raw.trim().split("\n").slice(1).map((l) => l.trim()).filter(Boolean);
}

function csvLineToParts(row: string) {
  return row.split(",");
}

function sumJvRows(rows: string[]) {
  let debit = 0;
  let credit = 0;
  for (const row of rows) {
    const parts = csvLineToParts(row);
    const dr = Number(parts[3]);
    const cr = Number(parts[4]);
    if (Number.isFinite(dr)) debit += dr;
    if (Number.isFinite(cr)) credit += cr;
  }
  return {
    debit: Math.round(debit * 100) / 100,
    credit: Math.round(credit * 100) / 100,
  };
}

function buildDinSummary(
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

async function loadDinContext() {
  const din = await prisma.driver.findFirst({
    where: { name: "Din" },
    include: {
      payrollMonths: {
        where: { yearMonth: { in: ["2026-06", "2026-07"] } },
        include: { trips: true, extras: true },
        orderBy: { yearMonth: "asc" },
      },
    },
  });
  if (!din) throw new Error("Din not found");
  const june = din.payrollMonths.find((m) => m.yearMonth === "2026-06");
  const july = din.payrollMonths.find((m) => m.yearMonth === "2026-07");
  if (!june) throw new Error("Din June payroll missing");
  return { din, june, july };
}

function printDinPreview(
  din: Awaited<ReturnType<typeof loadDinContext>>["din"],
  summary: ReturnType<typeof buildDinSummary>,
  dinJv: ReturnType<typeof buildDriverJvFromSummary>
) {
  console.log("\n========== DIN JUNE FULL DETAIL ==========");
  console.log({
    driver: din.name,
    fullName: din.fullName,
    baseSalary: summary.baseSalary,
    wages: payslipWagesTotal(summary),
    grossSalary: summary.grossSalary,
    epfEmployer: summary.statutory.epfEmployer,
    epfEmployee: summary.statutory.epfEmployee,
    socsoEmployer: summary.statutory.socsoEmployer,
    socsoEmployee: summary.statutory.socsoEmployee,
    eisEmployer: summary.statutory.eisEmployer,
    eisEmployee: summary.statutory.eisEmployee,
    lindung24Jam: summary.statutory.lindung24Jam,
    pcb: summary.statutory.pcb,
    advanceTotal: summary.advanceTotal,
    balanceBeforeAdvance: payslipBalanceBeforeAdvance(summary),
    advanceRecovered: payslipAdvanceRecoveredFromPay(summary),
    advanceWriteOff: payslipAdvanceWriteOff(summary),
    netSalary: summary.netSalary,
    writeOffAccount: SHARED_PAYROLL_JV_ACCOUNTS.advanceWriteOff,
  });

  console.log("\n=== Din JV lines ===");
  for (const line of dinJv.lines) {
    console.log(
      `  ${line.accountCode} Dr=${line.debit || ""} Cr=${line.credit || ""} | ${line.description}`
    );
  }
  console.log({
    jvNo: dinJv.jvNo,
    balanced: dinJv.balanced,
    debitTotal: dinJv.debitTotal,
    creditTotal: dinJv.creditTotal,
    imbalance: dinJv.imbalance,
    amounts: dinJv.amounts,
  });
}

async function buildRev7Preview(dinJv: ReturnType<typeof buildDriverJvFromSummary>) {
  const rev6Path = payrollJvOutputPath(REV6_FILENAME);
  const rev6Rows = parseCsvRows(fs.readFileSync(rev6Path, "utf8"));
  const dinRows = dinJv.lines.map((line) =>
    [
      line.date,
      line.jvNo,
      line.accountCode,
      line.debit > 0 ? line.debit.toFixed(2) : "",
      line.credit > 0 ? line.credit.toFixed(2) : "",
      line.description,
    ].join(",")
  );
  const rev7Rows = [...rev6Rows, ...dinRows];

  const rev6Set = new Set(rev6Rows);
  const onlyRev7 = rev7Rows.filter((r) => !rev6Set.has(r));
  const onlyRev6 = rev6Rows.filter((r) => !rev7Rows.includes(r));

  const rev6Totals = sumJvRows(rev6Rows);
  const rev7Totals = sumJvRows(rev7Rows);
  const dinTotals = sumJvRows(dinRows);

  console.log("\n========== REV7 vs REV6 ==========");
  console.log({
    rev6Rows: rev6Rows.length,
    dinJvRows: dinRows.length,
    rev7Rows: rev7Rows.length,
    onlyRev7: onlyRev7.length,
    onlyRev6: onlyRev6.length,
    rev6Debit: rev6Totals.debit,
    rev6Credit: rev6Totals.credit,
    dinDebit: dinTotals.debit,
    dinCredit: dinTotals.credit,
    rev7Debit: rev7Totals.debit,
    rev7Credit: rev7Totals.credit,
    rev7Balanced: rev7Totals.debit === rev7Totals.credit,
  });

  if (onlyRev6.length > 0) {
    throw new Error("rev7 would alter rev6 rows");
  }
  if (rev7Totals.debit !== rev7Totals.credit) {
    throw new Error(`rev7 unbalanced: ${rev7Totals.debit} vs ${rev7Totals.credit}`);
  }
  if (!dinJv.balanced) {
    throw new Error(`Din JV unbalanced: ${dinJv.imbalance}`);
  }

  return { rev6Rows, rev7Rows, rev7Csv: `\uFEFF${fs.readFileSync(rev6Path, "utf8").split("\n")[0]}\n${rev7Rows.join("\n")}\n` };
}

async function previewPhase() {
  const { din, june, july } = await loadDinContext();
  const summary = buildDinSummary(din, june, PROPOSED_BASE);
  const dinJv = buildDriverJvFromSummary({
    driver: {
      id: din.id,
      name: din.name,
      fullName: din.fullName,
      accountCodeSuffix: din.accountCodeSuffix ?? "DIN1",
    },
    summary,
    jvNo: "JV-2606-014",
    jvDate: "2026-06-30",
  });

  printDinPreview(din, summary, dinJv);
  const rev7 = await buildRev7Preview(dinJv);

  console.log("\n========== 14-DRIVER JV OVERVIEW (rev7) ==========");
  console.log("Drivers: 13 from rev6 unchanged + Din JV-2606-014");
  console.log(`Write-off account: ${SHARED_PAYROLL_JV_ACCOUNTS.advanceWriteOff}`);

  if (july) {
    console.log("\nJuly ghost record to DELETE:", {
      id: july.id,
      yearMonth: july.yearMonth,
    });
  }

  console.log("\nEligibility after update:");
  const proposed = { active: true, terminationDate: PROPOSED_TERMINATION };
  console.log("June:", isDriverEligibleForPayrollMonth(proposed, 2026, 6));
  console.log("July:", isDriverEligibleForPayrollMonth(proposed, 2026, 7));

  return { din, june, july, summary, dinJv, rev7 };
}

async function applyPhase(ctx: Awaited<ReturnType<typeof previewPhase>>) {
  console.log("\n========== APPLYING ==========");

  console.log("1. UPDATE Din...");
  await prisma.driver.update({
    where: { id: ctx.din.id },
    data: {
      baseSalary: PROPOSED_BASE,
      terminationDate: PROPOSED_TERMINATION,
      active: true,
    },
  });

  if (ctx.july) {
    console.log("2. DELETE Din 2026-07 payroll month...");
    await prisma.driverPayrollMonth.delete({ where: { id: ctx.july.id } });
  } else {
    console.log("2. No July ghost record (skip delete)");
  }

  console.log("3. Write rev7 CSV...");
  const rev7Path = payrollJvOutputPath(REV7_FILENAME);
  fs.mkdirSync(path.dirname(rev7Path), { recursive: true });
  const header = fs
    .readFileSync(payrollJvOutputPath(REV6_FILENAME), "utf8")
    .split("\n")[0];
  const rev7Body = ctx.rev7.rev7Rows.join("\n");
  fs.writeFileSync(rev7Path, `\uFEFF${header}\n${rev7Body}\n`, "utf8");

  console.log("4. Manifest rev6 void + rev7 active...");
  voidPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV6_FILENAME,
    voidReason: REV6_VOID_REASON,
    supersededBy: REV7_FILENAME,
  });
  registerPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV7_FILENAME,
    status: "active",
    revision: 7,
    driverCount: 14,
    notes: `Din termination 2026-06-10; base 550; advance write-off ${ctx.dinJv.amounts.advanceWriteOff} → ${SHARED_PAYROLL_JV_ACCOUNTS.advanceWriteOff}`,
  });

  console.log("5. Generate Din payslip...");
  fs.mkdirSync(OUT, { recursive: true });
  const css = fs.readFileSync(
    path.join(process.cwd(), "components/driver-payroll/driver-payslip-print.css"),
    "utf8"
  );
  const advances = ctx.june.extras
    .filter((e) => e.type === "advance")
    .map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      amount: decimalToNumber(e.amount) ?? 0,
      note: e.note,
    }));
  const body = renderToStaticMarkup(
    React.createElement(DriverPayslipPrint, {
      year: YEAR,
      month: MONTH,
      driver: {
        payrollName: ctx.din.fullName?.trim() || ctx.din.name,
        name: ctx.din.name,
        icNumber: ctx.din.icNumber,
        baseSalary: PROPOSED_BASE,
        bankName: ctx.din.bankName,
        bankAccount: ctx.din.bankAccount,
      },
      summary: ctx.summary,
      advances,
    })
  );
  const pngPath = path.join(OUT, "payslip-din-june-2026-rev7.png");
  const htmlFile = path.join(OUT, "payslip-din-june-2026-rev7.html");
  fs.writeFileSync(
    htmlFile,
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${body}</body></html>`,
    "utf8"
  );

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.goto(`file:///${htmlFile.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.locator(".driver-payslip-print").screenshot({ path: pngPath });
    await browser.close();
    console.log("Payslip PNG:", pngPath);
  } catch (e) {
    console.log("Payslip PNG skipped:", e instanceof Error ? e.message : e);
    console.log("Payslip HTML:", htmlFile);
  }

  const updated = await prisma.driver.findUnique({
    where: { id: ctx.din.id },
    select: { baseSalary: true, terminationDate: true, active: true },
  });
  const julyLeft = await prisma.driverPayrollMonth.count({
    where: { driverId: ctx.din.id, yearMonth: "2026-07" },
  });
  const manifest = readPayrollJvManifest();
  const rev6 = manifest.entries.find((e) => e.filename === REV6_FILENAME);
  const rev7 = manifest.entries.find((e) => e.filename === REV7_FILENAME);

  console.log("\n========== POST-APPLY VERIFY ==========");
  console.log({
    dinBaseSalary: decimalToNumber(updated?.baseSalary),
    terminationDate: updated?.terminationDate?.toISOString().slice(0, 10),
    active: updated?.active,
    julyRecordsLeft: julyLeft,
    rev6Status: rev6?.status,
    rev7Status: rev7?.status,
    rev7Path,
  });
}

async function main() {
  console.log("0. prisma migrate deploy (schema)...");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  const ctx = await previewPhase();
  console.log("\n>>> Preview OK — applying data writes...\n");
  await applyPhase(ctx);
  console.log("\nDONE (no git commit/push).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
