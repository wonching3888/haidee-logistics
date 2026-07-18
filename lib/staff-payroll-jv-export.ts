import { buildStaffJvAccountCodes } from "@/lib/constants/staff-payroll-jv-accounts";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { decimalToNumber } from "@/lib/freight-rates";
import { emptyPcbYtd, priorPayrollYearMonth } from "@/lib/pcb-policy";
import { buildStaffMonthPayrollSummary } from "@/lib/staff-payroll-calc";
import type { StaffPayrollSummary } from "@/lib/staff-payroll-statutory";
import {
  isStaffEligibleForPayrollMonth,
  parseStaffYearMonth,
  ensureStaffPayrollMonth,
} from "@/lib/staff-payroll-month";
import { loadPcbYtdBalancesAsOf } from "@/lib/staff-pcb-ytd-balance";
import { prisma } from "@/lib/prisma";

const BALANCE_TOLERANCE = 0.01;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

function formatStaffJvNo(year: number, month: number) {
  return `JV-STAFF-${jvMonthToken(year, month)}`;
}

export interface StaffPayrollJvLine {
  date: string;
  jvNo: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
}

export interface StaffPayrollJvPerson {
  staffId: string;
  staffName: string;
  accountCodeSuffix: string;
  payrollCategory: string;
  amounts: {
    baseSalary: number;
    epfEmployer: number;
    socsoEisEmployer: number;
    epfPayable: number;
    socsoEisLindungPayable: number;
    lindung24Jam: number;
    pcb: number;
    netSalary: number;
  };
}

export interface SkippedStaffPayrollJv {
  staffId: string;
  staffName: string;
  reason: string;
}

export interface MonthlyStaffPayrollJvResult {
  year: number;
  month: number;
  yearMonth: string;
  jvDate: string;
  jvNo: string;
  staff: StaffPayrollJvPerson[];
  skippedStaff: SkippedStaffPayrollJv[];
  flatLines: StaffPayrollJvLine[];
  debitTotal: number;
  creditTotal: number;
  imbalance: number;
  balanced: boolean;
  allBalanced: boolean;
}

function pushDebitLine(
  lines: StaffPayrollJvLine[],
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
  lines: StaffPayrollJvLine[],
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

export function buildStaffPersonJvAmounts(summary: StaffPayrollSummary) {
  const { statutory } = summary;
  const epfEmployer = statutory.epfEmployer;
  const socsoEisEmployer = roundMoney(
    statutory.socsoEmployer + statutory.eisEmployer
  );
  const epfPayable = roundMoney(statutory.epfEmployee + statutory.epfEmployer);
  const lindung24Jam = statutory.lindung24Jam;
  const socsoEisLindungPayable = roundMoney(
    statutory.socsoEmployee +
      statutory.eisEmployee +
      statutory.socsoEmployer +
      statutory.eisEmployer +
      lindung24Jam
  );
  return {
    baseSalary: summary.baseSalary,
    epfEmployer,
    socsoEisEmployer,
    epfPayable,
    socsoEisLindungPayable,
    lindung24Jam,
    pcb: statutory.pcb,
    netSalary: summary.netSalary,
  };
}

/** Push per-staff expense + net lines (no shared payable credits). */
export function pushStaffPersonExpenseLines(input: {
  lines: StaffPayrollJvLine[];
  staff: {
    name: string;
    accountCodeSuffix: string;
    payrollCategory: string;
  };
  amounts: ReturnType<typeof buildStaffPersonJvAmounts>;
  jvNo: string;
  jvDate: string;
}) {
  const accounts = buildStaffJvAccountCodes({
    accountCodeSuffix: input.staff.accountCodeSuffix,
    payrollCategory: input.staff.payrollCategory,
  });
  const label = input.staff.name;
  const { amounts } = input;

  pushDebitLine(input.lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.baseSalary,
    amount: amounts.baseSalary,
    description: `底薪 Base Salary - ${label}`,
  });
  pushDebitLine(input.lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.epfEmployer,
    amount: amounts.epfEmployer,
    description: `EPF雇主 EPF Employer - ${label}`,
  });
  pushDebitLine(input.lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.socsoEisEmployer,
    amount: amounts.socsoEisEmployer,
    description: `SOCSO+EIS雇主 SOCSO/EIS Employer - ${label}`,
  });
  pushCreditLine(input.lines, {
    date: input.jvDate,
    jvNo: input.jvNo,
    accountCode: accounts.netPayable,
    amount: amounts.netSalary,
    description: `实发 Net Pay - ${label}`,
  });
}

export async function buildMonthlyStaffJvRows(
  year: number,
  month: number
): Promise<MonthlyStaffPayrollJvResult> {
  const yearMonth = parseStaffYearMonth(year, month);
  const jvDate = jvDateForMonth(year, month);
  const jvNo = formatStaffJvNo(year, month);
  const priorYm = priorPayrollYearMonth(year, month);

  const [allStaff, ytdBalances] = await Promise.all([
    prisma.staff.findMany({
      where: {
        OR: [{ active: true }, { terminationDate: { not: null } }],
      },
      orderBy: { name: "asc" },
    }),
    loadPcbYtdBalancesAsOf(priorYm),
  ]);

  const skippedStaff: SkippedStaffPayrollJv[] = [];
  const staffPeople: StaffPayrollJvPerson[] = [];
  const lines: StaffPayrollJvLine[] = [];

  let sumEpfPayable = 0;
  let sumSocsoEisLindungPayable = 0;
  let sumPcb = 0;

  for (const staff of allStaff) {
    if (!isStaffEligibleForPayrollMonth(staff, year, month)) {
      skippedStaff.push({
        staffId: staff.id,
        staffName: staff.name,
        reason: "inactive / 离职后月份 Skipped",
      });
      continue;
    }

    const suffix = staff.accountCodeSuffix?.trim().toUpperCase();
    if (!suffix) {
      skippedStaff.push({
        staffId: staff.id,
        staffName: staff.name,
        reason: "缺少科目后缀 accountCodeSuffix 未设定",
      });
      continue;
    }

    await ensureStaffPayrollMonth(staff.id, year, month);
    const monthRecord = await prisma.staffPayrollMonth.findUnique({
      where: { staffId_yearMonth: { staffId: staff.id, yearMonth } },
    });

    const summary = buildStaffMonthPayrollSummary({
      baseSalary: decimalToNumber(staff.baseSalary),
      maritalStatus: staff.maritalStatus as MaritalStatus | null,
      spouseWorking: staff.spouseWorking,
      childCount: staff.childCount,
      isSocsoSecondCategory: staff.isSocsoSecondCategory,
      lindung24JamOptOut: staff.lindung24JamOptOut,
      year,
      month,
      pcbYtdBeforeMonth: ytdBalances.get(staff.id) ?? emptyPcbYtd(),
      pcbLocked: monthRecord?.pcbLocked,
      pcbFinal: decimalToNumber(monthRecord?.pcbFinal),
      monthOverrides: monthRecord,
    });

    const amounts = buildStaffPersonJvAmounts(summary);
    staffPeople.push({
      staffId: staff.id,
      staffName: staff.name,
      accountCodeSuffix: suffix,
      payrollCategory: staff.payrollCategory,
      amounts,
    });

    pushStaffPersonExpenseLines({
      lines,
      staff: {
        name: staff.name,
        accountCodeSuffix: suffix,
        payrollCategory: staff.payrollCategory,
      },
      amounts,
      jvNo,
      jvDate,
    });

    sumEpfPayable = roundMoney(sumEpfPayable + amounts.epfPayable);
    sumSocsoEisLindungPayable = roundMoney(
      sumSocsoEisLindungPayable + amounts.socsoEisLindungPayable
    );
    sumPcb = roundMoney(sumPcb + amounts.pcb);
  }

  // Shared company remittance accounts — one line each for the month.
  if (staffPeople.length > 0) {
    const sampleAccounts = buildStaffJvAccountCodes({
      accountCodeSuffix: staffPeople[0].accountCodeSuffix,
      payrollCategory: staffPeople[0].payrollCategory,
    });
    pushCreditLine(lines, {
      date: jvDate,
      jvNo,
      accountCode: sampleAccounts.epfPayable,
      amount: sumEpfPayable,
      description: `EPF应付 EPF Payable (staff ${yearMonth})`,
    });
    pushCreditLine(lines, {
      date: jvDate,
      jvNo,
      accountCode: sampleAccounts.socsoEisPayable,
      amount: sumSocsoEisLindungPayable,
      description: `SOCSO/EIS/Lindung 应付 PERKESO Payable (staff ${yearMonth})`,
    });
    pushCreditLine(lines, {
      date: jvDate,
      jvNo,
      accountCode: sampleAccounts.pcbPayable,
      amount: sumPcb,
      description: `PCB应付 PCB Payable (staff ${yearMonth})`,
    });
  }

  const debitTotal = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
  const creditTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.credit, 0)
  );
  const imbalance = roundMoney(debitTotal - creditTotal);
  const balanced = Math.abs(imbalance) <= BALANCE_TOLERANCE;

  return {
    year,
    month,
    yearMonth,
    jvDate,
    jvNo,
    staff: staffPeople,
    skippedStaff,
    flatLines: lines,
    debitTotal,
    creditTotal,
    imbalance,
    balanced,
    allBalanced: balanced,
  };
}

function csvEscape(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function generateStaffPayrollJvCsv(
  result: MonthlyStaffPayrollJvResult
): string {
  if (!result.allBalanced) {
    throw new Error(
      `员工 JV 借贷不平衡，无法导出 Unbalanced staff JV: 差额 ${result.imbalance.toFixed(2)} MYR`
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

export function staffPayrollJvCsvFilename(year: number, month: number) {
  return `staff-payroll-jv-${parseStaffYearMonth(year, month)}.csv`;
}
