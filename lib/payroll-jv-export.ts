import { buildDriverJvAccountCodes } from "@/lib/constants/payroll-jv-accounts";
import { decimalToNumber } from "@/lib/freight-rates";
import type { MaritalStatus } from "@/lib/constants/payroll";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
  type DriverPayrollMonthInput,
} from "@/lib/payroll-fleet";
import type { PayrollSummary } from "@/lib/payroll-statutory";
import { getDriverPayrollName } from "@/lib/trip-allowance";
import { prisma } from "@/lib/prisma";
import { syncFleetPayrollForMonth } from "@/lib/payroll-month-sync";

const BALANCE_TOLERANCE = 0.01;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function jvMonthToken(year: number, month: number) {
  const yy = String(year % 100).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${yy}${mm}`;
}

function jvDateForMonth(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0));
  const y = lastDay.getUTCFullYear();
  const m = String(lastDay.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lastDay.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatJvNo(year: number, month: number, sequence: number) {
  return `JV-${jvMonthToken(year, month)}-${String(sequence).padStart(3, "0")}`;
}

export interface PayrollJvLine {
  date: string;
  jvNo: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
}

export interface DriverPayrollJv {
  driverId: string;
  driverName: string;
  payrollName: string;
  accountCodeSuffix: string;
  jvNo: string;
  lines: PayrollJvLine[];
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
  imbalance: number;
  amounts: {
    baseSalary: number;
    wages: number;
    epfEmployer: number;
    socsoEisEmployer: number;
    epfPayable: number;
    socsoEisPayable: number;
    pcb: number;
    advance: number;
    netSalary: number;
  };
}

export interface SkippedPayrollJvDriver {
  driverId: string;
  driverName: string;
  reason: string;
}

export interface MonthlyPayrollJvResult {
  year: number;
  month: number;
  yearMonth: string;
  jvDate: string;
  drivers: DriverPayrollJv[];
  skippedDrivers: SkippedPayrollJvDriver[];
  imbalancedDrivers: Array<{
    driverId: string;
    driverName: string;
    jvNo: string;
    debitTotal: number;
    creditTotal: number;
    imbalance: number;
  }>;
  allBalanced: boolean;
  flatLines: PayrollJvLine[];
}

function pushDebitLine(
  lines: PayrollJvLine[],
  input: {
    date: string;
    jvNo: string;
    accountCode: string;
    amount: number;
    description: string;
  }
) {
  if (input.amount <= 0) return;
  lines.push({
    date: input.date,
    jvNo: input.jvNo,
    accountCode: input.accountCode,
    debit: roundMoney(input.amount),
    credit: 0,
    description: input.description,
  });
}

function pushCreditLine(
  lines: PayrollJvLine[],
  input: {
    date: string;
    jvNo: string;
    accountCode: string;
    amount: number;
    description: string;
  }
) {
  if (input.amount <= 0) return;
  lines.push({
    date: input.date,
    jvNo: input.jvNo,
    accountCode: input.accountCode,
    debit: 0,
    credit: roundMoney(input.amount),
    description: input.description,
  });
}

export function buildDriverJvFromSummary(input: {
  driver: {
    id: string;
    name: string;
    fullName: string | null;
    accountCodeSuffix: string;
  };
  summary: PayrollSummary;
  jvNo: string;
  jvDate: string;
}): DriverPayrollJv {
  const accounts = buildDriverJvAccountCodes({
    accountCodeSuffix: input.driver.accountCodeSuffix,
  });
  const payrollName = getDriverPayrollName({
    name: input.driver.name,
    fullName: input.driver.fullName,
  });
  const { statutory } = input.summary;

  const wages = roundMoney(
    input.summary.tripAllowanceTotal +
      input.summary.charterSalaryTotal +
      input.summary.crateCommissionTotal +
      input.summary.extraAllowanceTotal
  );
  const epfEmployer = statutory.epfEmployer;
  const socsoEisEmployer = roundMoney(
    statutory.socsoEmployer + statutory.eisEmployer
  );
  const epfPayable = roundMoney(statutory.epfEmployee + statutory.epfEmployer);
  const socsoEisPayable = roundMoney(
    statutory.socsoEmployee +
      statutory.eisEmployee +
      statutory.socsoEmployer +
      statutory.eisEmployer
  );

  const amounts = {
    baseSalary: input.summary.baseSalary,
    wages,
    epfEmployer,
    socsoEisEmployer,
    epfPayable,
    socsoEisPayable,
    pcb: statutory.pcb,
    advance: input.summary.advanceTotal,
    netSalary: input.summary.netSalary,
  };

  const lines: PayrollJvLine[] = [];
  const label = payrollName;

  pushDebitLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.baseSalary,
    amount: amounts.baseSalary,
    description: `底薪 Base Salary - ${label}`,
  });
  pushDebitLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.wages,
    amount: amounts.wages,
    description: `工钱 Wages - ${label}`,
  });
  pushDebitLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.epfEmployer,
    amount: amounts.epfEmployer,
    description: `EPF雇主 EPF Employer - ${label}`,
  });
  pushDebitLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.socsoEisEmployer,
    amount: amounts.socsoEisEmployer,
    description: `SOCSO+EIS雇主 SOCSO/EIS Employer - ${label}`,
  });

  pushCreditLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.epfPayable,
    amount: amounts.epfPayable,
    description: `EPF应付 EPF Payable - ${label}`,
  });
  pushCreditLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.socsoEisPayable,
    amount: amounts.socsoEisPayable,
    description: `SOCSO/EIS应付 SOCSO/EIS Payable - ${label}`,
  });
  pushCreditLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.pcbPayable,
    amount: amounts.pcb,
    description: `PCB应付 PCB Payable - ${label}`,
  });
  pushCreditLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.advance,
    amount: amounts.advance,
    description: `借支 Advance - ${label}`,
  });
  pushCreditLine(lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.netPayable,
    amount: amounts.netSalary,
    description: `实发 Net Pay - ${label}`,
  });

  const debitTotal = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
  const creditTotal = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));
  const imbalance = roundMoney(debitTotal - creditTotal);
  const balanced = Math.abs(imbalance) <= BALANCE_TOLERANCE;

  return {
    driverId: input.driver.id,
    driverName: input.driver.name,
    payrollName,
    accountCodeSuffix: input.driver.accountCodeSuffix,
    jvNo: input.jvNo,
    lines,
    debitTotal,
    creditTotal,
    balanced,
    imbalance,
    amounts,
  };
}

export async function buildMonthlyDriverJvRows(
  year: number,
  month: number
): Promise<MonthlyPayrollJvResult> {
  await syncFleetPayrollForMonth(year, month);

  const yearMonth = parseYearMonth(year, month);
  const jvDate = jvDateForMonth(year, month);

  const drivers = await prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      payrollMonths: {
        where: { yearMonth },
        include: { trips: true, extras: true },
      },
    },
  });

  const skippedDrivers: SkippedPayrollJvDriver[] = [];
  const driverJvs: DriverPayrollJv[] = [];
  let sequence = 0;

  for (const driver of drivers) {
    const suffix = driver.accountCodeSuffix?.trim().toUpperCase();
    if (!suffix) {
      skippedDrivers.push({
        driverId: driver.id,
        driverName: driver.name,
        reason: "缺少科目后缀 accountCodeSuffix 未设定",
      });
      continue;
    }

    sequence += 1;
    const jvNo = formatJvNo(year, month, sequence);

    const driverInput: DriverPayrollDriverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
    };
    const monthRecord = driver.payrollMonths[0];
    const monthInput: DriverPayrollMonthInput = {
      trips: monthRecord?.trips ?? [],
      extras: monthRecord?.extras ?? [],
      epfEmployeeOverride: monthRecord?.epfEmployeeOverride,
      epfEmployerOverride: monthRecord?.epfEmployerOverride,
      socsoEmployeeOverride: monthRecord?.socsoEmployeeOverride,
      socsoEmployerOverride: monthRecord?.socsoEmployerOverride,
      eisEmployeeOverride: monthRecord?.eisEmployeeOverride,
      eisEmployerOverride: monthRecord?.eisEmployerOverride,
      pcbOverride: monthRecord?.pcbOverride,
    };

    const summary = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips: monthInput.trips,
      extras: monthInput.extras,
      overrides: monthInput,
    });

    driverJvs.push(
      buildDriverJvFromSummary({
        driver: {
          id: driver.id,
          name: driver.name,
          fullName: driver.fullName,
          accountCodeSuffix: suffix,
        },
        summary,
        jvNo,
        jvDate,
      })
    );
  }

  const imbalancedDrivers = driverJvs
    .filter((jv) => !jv.balanced)
    .map((jv) => ({
      driverId: jv.driverId,
      driverName: jv.driverName,
      jvNo: jv.jvNo,
      debitTotal: jv.debitTotal,
      creditTotal: jv.creditTotal,
      imbalance: jv.imbalance,
    }));

  return {
    year,
    month,
    yearMonth,
    jvDate,
    drivers: driverJvs,
    skippedDrivers,
    imbalancedDrivers,
    allBalanced: imbalancedDrivers.length === 0,
    flatLines: driverJvs.flatMap((jv) => jv.lines),
  };
}

function csvEscape(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function generatePayrollJvCsv(result: MonthlyPayrollJvResult): string {
  if (!result.allBalanced) {
    const details = result.imbalancedDrivers
      .map(
        (row) =>
          `${row.driverName} (${row.jvNo}): 差额 ${row.imbalance.toFixed(2)} MYR`
      )
      .join("; ");
    throw new Error(
      `JV 借贷不平衡，无法导出 Unbalanced JV entries: ${details}`
    );
  }

  const headers = [
    "日期 Date",
    "JV号 JVNo",
    "科目码 AccountCode",
    "借 Debit",
    "贷 Credit",
    "备注 Description",
  ];

  const rows = result.flatLines.map((line) =>
    [
      line.date,
      line.jvNo,
      line.accountCode,
      line.debit > 0 ? line.debit.toFixed(2) : "",
      line.credit > 0 ? line.credit.toFixed(2) : "",
      line.description,
    ]
      .map(csvEscape)
      .join(",")
  );

  return `\uFEFF${headers.join(",")}\n${rows.join("\n")}\n`;
}

export function payrollJvCsvFilename(year: number, month: number) {
  return `payroll-jv-${parseYearMonth(year, month)}.csv`;
}
