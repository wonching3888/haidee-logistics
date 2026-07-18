"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  canViewStaffPayroll,
  canWriteStaffPayroll,
} from "@/lib/auth-roles";
import {
  derivePcbNeedsReview,
  normalizeSpouseWorking,
} from "@/lib/driver-pcb-profile";
import { isMaritalStatus, type MaritalStatus } from "@/lib/constants/payroll";
import { toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types";

const PAYROLL_CATEGORIES = ["salary", "director_remuneration"] as const;
type StaffPayrollCategory = (typeof PAYROLL_CATEGORIES)[number];

function isStaffPayrollCategory(value: string): value is StaffPayrollCategory {
  return (PAYROLL_CATEGORIES as readonly string[]).includes(value);
}

async function requireStaffPayrollAccess() {
  const user = await getCurrentUser();
  if (!user || !canViewStaffPayroll(user.role as UserRole)) {
    throw new Error("无权限查看 Unauthorized");
  }
  return user;
}

async function requireStaffPayrollWriteAccess() {
  const user = await getCurrentUser();
  if (!user || !canWriteStaffPayroll(user.role as UserRole)) {
    throw new Error("无写入权限 Unauthorized");
  }
  return user;
}

function serializeStaff(staff: {
  id: string;
  name: string;
  nickname: string | null;
  fullName: string | null;
  active: boolean;
  terminationDate: Date | null;
  startDate: Date | null;
  baseSalary: unknown;
  autoCountEmployeeCode: string | null;
  icNumber: string | null;
  epfNumber: string | null;
  socsoNumber: string | null;
  bankName: string | null;
  bankAccount: string | null;
  maritalStatus: string | null;
  spouseWorking: boolean | null;
  pcbNeedsReview: boolean;
  childCount: number;
  accountCodeSuffix: string | null;
  isSocsoSecondCategory: boolean;
  lindung24JamOptOut: boolean;
  payrollCategory: string;
  tinNumber: string | null;
  phoneNumber: string | null;
}) {
  return {
    id: staff.id,
    name: staff.name,
    nickname: staff.nickname,
    fullName: staff.fullName,
    active: staff.active,
    terminationDate: staff.terminationDate
      ? toDateInputValue(staff.terminationDate)
      : null,
    startDate: staff.startDate ? toDateInputValue(staff.startDate) : null,
    baseSalary: decimalToNumber(staff.baseSalary),
    autoCountEmployeeCode: staff.autoCountEmployeeCode,
    icNumber: staff.icNumber,
    epfNumber: staff.epfNumber,
    socsoNumber: staff.socsoNumber,
    bankName: staff.bankName,
    bankAccount: staff.bankAccount,
    maritalStatus: staff.maritalStatus as MaritalStatus | null,
    spouseWorking: staff.spouseWorking,
    pcbNeedsReview: derivePcbNeedsReview({
      maritalStatus: staff.maritalStatus,
      spouseWorking: staff.spouseWorking,
    }),
    childCount: staff.childCount,
    accountCodeSuffix: staff.accountCodeSuffix,
    isSocsoSecondCategory: staff.isSocsoSecondCategory,
    lindung24JamOptOut: staff.lindung24JamOptOut,
    payrollCategory: staff.payrollCategory,
    tinNumber: staff.tinNumber,
    phoneNumber: staff.phoneNumber,
  };
}

export async function getStaffPayrollSettingsData() {
  await requireStaffPayrollAccess();
  const rows = await prisma.staff.findMany({
    orderBy: { name: "asc" },
  });
  return rows.map(serializeStaff);
}

export async function saveStaffPayrollMaster(input: {
  id?: string;
  name: string;
  nickname?: string | null;
  fullName?: string | null;
  active: boolean;
  terminationDate?: string | null;
  startDate?: string | null;
  baseSalary?: number | null;
  autoCountEmployeeCode?: string | null;
  icNumber?: string | null;
  epfNumber?: string | null;
  socsoNumber?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  maritalStatus?: string | null;
  spouseWorking?: boolean | null;
  childCount?: number;
  accountCodeSuffix?: string | null;
  isSocsoSecondCategory?: boolean;
  lindung24JamOptOut?: boolean;
  payrollCategory?: string;
  tinNumber?: string | null;
  phoneNumber?: string | null;
}) {
  await requireStaffPayrollWriteAccess();
  if (!input.name.trim()) {
    throw new Error("姓名不能为空 Name is required");
  }
  if (
    input.maritalStatus &&
    input.maritalStatus !== "" &&
    !isMaritalStatus(input.maritalStatus)
  ) {
    throw new Error("无效婚姻状况 Invalid marital status");
  }

  const payrollCategoryRaw = input.payrollCategory?.trim() || "salary";
  if (!isStaffPayrollCategory(payrollCategoryRaw)) {
    throw new Error("无效薪资类别 Invalid payroll category");
  }

  const terminationDate = input.terminationDate?.trim()
    ? new Date(`${input.terminationDate.trim()}T00:00:00.000Z`)
    : null;
  const startDate = input.startDate?.trim()
    ? new Date(`${input.startDate.trim()}T00:00:00.000Z`)
    : null;

  const maritalStatus =
    input.maritalStatus && input.maritalStatus !== ""
      ? input.maritalStatus
      : null;
  const spouseWorking = normalizeSpouseWorking({
    maritalStatus,
    spouseWorking: input.spouseWorking,
  });
  const pcbNeedsReview = derivePcbNeedsReview({
    maritalStatus,
    spouseWorking,
  });

  const data = {
    name: input.name.trim(),
    nickname: input.nickname?.trim() || null,
    fullName: input.fullName?.trim() || null,
    active: input.active,
    terminationDate,
    startDate,
    baseSalary: input.baseSalary ?? null,
    autoCountEmployeeCode: input.autoCountEmployeeCode?.trim() || null,
    icNumber: input.icNumber?.trim() || null,
    epfNumber: input.epfNumber?.trim() || null,
    socsoNumber: input.socsoNumber?.trim() || null,
    bankName: input.bankName?.trim() || null,
    bankAccount: input.bankAccount?.trim() || null,
    maritalStatus,
    spouseWorking,
    pcbNeedsReview,
    childCount: input.childCount ?? 0,
    accountCodeSuffix: input.accountCodeSuffix?.trim().toUpperCase() || null,
    isSocsoSecondCategory: Boolean(input.isSocsoSecondCategory),
    lindung24JamOptOut: Boolean(input.lindung24JamOptOut),
    payrollCategory: payrollCategoryRaw,
    tinNumber: input.tinNumber?.trim() || null,
    phoneNumber: input.phoneNumber?.trim() || null,
  };

  if (input.id) {
    await prisma.staff.update({ where: { id: input.id }, data });
  } else {
    await prisma.staff.create({ data });
  }

  revalidatePath("/settings");
  revalidatePath("/staff-payroll");
}

export async function deleteStaffPayrollMaster(id: string) {
  await requireStaffPayrollWriteAccess();
  await prisma.staff.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings");
  revalidatePath("/staff-payroll");
}

export async function getStaffPayrollStaff(input: {
  year: number;
  month: number;
}) {
  await requireStaffPayrollAccess();
  const {
    isStaffEligibleForPayrollMonth,
  } = await import("@/lib/staff-payroll-month");
  const rows = await prisma.staff.findMany({
    where: {
      OR: [{ active: true }, { terminationDate: { not: null } }],
    },
    orderBy: { name: "asc" },
  });
  return rows
    .filter((staff) =>
      isStaffEligibleForPayrollMonth(staff, input.year, input.month)
    )
    .map(serializeStaff);
}

export async function getStaffPayrollMonthlySummary(input: {
  year: number;
  month: number;
}) {
  await requireStaffPayrollAccess();
  const {
    ensureStaffPayrollMonth,
    isStaffEligibleForPayrollMonth,
    parseStaffYearMonth,
  } = await import("@/lib/staff-payroll-month");
  const { buildStaffMonthPayrollSummary } = await import(
    "@/lib/staff-payroll-calc"
  );
  const {
    loadPcbYtdBalancesAsOf,
  } = await import("@/lib/staff-pcb-ytd-balance");
  const { priorPayrollYearMonth, emptyPcbYtd } = await import(
    "@/lib/pcb-policy"
  );

  const yearMonth = parseStaffYearMonth(input.year, input.month);
  const allStaff = await prisma.staff.findMany({
    where: {
      OR: [{ active: true }, { terminationDate: { not: null } }],
    },
    orderBy: { name: "asc" },
  });
  const staffList = allStaff.filter((s) =>
    isStaffEligibleForPayrollMonth(s, input.year, input.month)
  );

  for (const s of staffList) {
    await ensureStaffPayrollMonth(s.id, input.year, input.month);
  }

  const ytdMap = await loadPcbYtdBalancesAsOf(
    priorPayrollYearMonth(input.year, input.month)
  );
  const months = await prisma.staffPayrollMonth.findMany({
    where: {
      yearMonth,
      staffId: { in: staffList.map((s) => s.id) },
    },
  });
  const monthByStaff = new Map(months.map((m) => [m.staffId, m]));

  const rows = staffList.map((staff) => {
    const monthRecord = monthByStaff.get(staff.id);
    const summary = buildStaffMonthPayrollSummary({
      baseSalary: decimalToNumber(staff.baseSalary),
      maritalStatus: staff.maritalStatus as MaritalStatus | null,
      spouseWorking: staff.spouseWorking,
      childCount: staff.childCount,
      isSocsoSecondCategory: staff.isSocsoSecondCategory,
      lindung24JamOptOut: staff.lindung24JamOptOut,
      year: input.year,
      month: input.month,
      pcbYtdBeforeMonth: ytdMap.get(staff.id) ?? emptyPcbYtd(),
      pcbLocked: monthRecord?.pcbLocked,
      pcbFinal: decimalToNumber(monthRecord?.pcbFinal),
      monthOverrides: monthRecord,
    });
    const employerContributionTotal =
      summary.statutory.epfEmployer +
      summary.statutory.socsoEmployer +
      summary.statutory.eisEmployer;
    return {
      staffId: staff.id,
      name: staff.name,
      nickname: staff.nickname,
      payrollCategory: staff.payrollCategory,
      baseSalary: summary.baseSalary,
      grossSalary: summary.grossSalary,
      epfEmployee: summary.statutory.epfEmployee,
      epfEmployer: summary.statutory.epfEmployer,
      socsoEmployee: summary.statutory.socsoEmployee,
      socsoEmployer: summary.statutory.socsoEmployer,
      lindung24Jam: summary.statutory.lindung24Jam,
      eisEmployee: summary.statutory.eisEmployee,
      eisEmployer: summary.statutory.eisEmployer,
      pcb: summary.statutory.pcb,
      netSalary: summary.netSalary,
      employerContributionTotal,
      hasMonthRecord: Boolean(monthRecord),
      lindung24JamOptOut: staff.lindung24JamOptOut,
      pcbNeedsReview: derivePcbNeedsReview({
        maritalStatus: staff.maritalStatus,
        spouseWorking: staff.spouseWorking,
      }),
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      baseSalary: acc.baseSalary + row.baseSalary,
      grossSalary: acc.grossSalary + row.grossSalary,
      epfEmployee: acc.epfEmployee + row.epfEmployee,
      epfEmployer: acc.epfEmployer + row.epfEmployer,
      socsoEmployee: acc.socsoEmployee + row.socsoEmployee,
      socsoEmployer: acc.socsoEmployer + row.socsoEmployer,
      lindung24Jam: acc.lindung24Jam + row.lindung24Jam,
      eisEmployee: acc.eisEmployee + row.eisEmployee,
      eisEmployer: acc.eisEmployer + row.eisEmployer,
      pcb: acc.pcb + row.pcb,
      netSalary: acc.netSalary + row.netSalary,
      employerContributionTotal:
        acc.employerContributionTotal + row.employerContributionTotal,
    }),
    {
      baseSalary: 0,
      grossSalary: 0,
      epfEmployee: 0,
      epfEmployer: 0,
      socsoEmployee: 0,
      socsoEmployer: 0,
      lindung24Jam: 0,
      eisEmployee: 0,
      eisEmployer: 0,
      pcb: 0,
      netSalary: 0,
      employerContributionTotal: 0,
    }
  );

  const grossMyr = totals.grossSalary;
  const netMyr = totals.netSalary;
  const employerMyr = totals.employerContributionTotal;
  const totalCostMyr = grossMyr + employerMyr;

  return {
    yearMonth,
    year: input.year,
    month: input.month,
    rows,
    totals,
    grossMyr,
    netMyr,
    employerMyr,
    totalCostMyr,
    hasRecords: rows.some((r) => r.hasMonthRecord),
  };
}

export async function getStaffPayrollMonth(input: {
  staffId: string;
  year: number;
  month: number;
}) {
  await requireStaffPayrollAccess();
  const { ensureStaffPayrollMonth, parseStaffYearMonth } = await import(
    "@/lib/staff-payroll-month"
  );
  const { buildStaffMonthPayrollSummary } = await import(
    "@/lib/staff-payroll-calc"
  );
  const { loadPcbYtdBalancesAsOf } = await import(
    "@/lib/staff-pcb-ytd-balance"
  );
  const { priorPayrollYearMonth, emptyPcbYtd } = await import(
    "@/lib/pcb-policy"
  );

  const staff = await prisma.staff.findUnique({ where: { id: input.staffId } });
  if (!staff) throw new Error("员工不存在 Staff not found");

  const yearMonth = await ensureStaffPayrollMonth(
    input.staffId,
    input.year,
    input.month
  );
  parseStaffYearMonth(input.year, input.month);

  const record = await prisma.staffPayrollMonth.findUnique({
    where: {
      staffId_yearMonth: { staffId: input.staffId, yearMonth },
    },
  });
  if (!record) throw new Error("薪资记录不存在 Payroll record not found");

  const ytdMap = await loadPcbYtdBalancesAsOf(
    priorPayrollYearMonth(input.year, input.month)
  );
  const pcbYtdBeforeMonth = ytdMap.get(input.staffId) ?? emptyPcbYtd();

  const summary = buildStaffMonthPayrollSummary({
    baseSalary: decimalToNumber(staff.baseSalary),
    maritalStatus: staff.maritalStatus as MaritalStatus | null,
    spouseWorking: staff.spouseWorking,
    childCount: staff.childCount,
    isSocsoSecondCategory: staff.isSocsoSecondCategory,
    lindung24JamOptOut: staff.lindung24JamOptOut,
    year: input.year,
    month: input.month,
    pcbYtdBeforeMonth,
    pcbLocked: record.pcbLocked,
    pcbFinal: decimalToNumber(record.pcbFinal),
    monthOverrides: record,
  });

  const autoStatutory = buildStaffMonthPayrollSummary({
    baseSalary: decimalToNumber(staff.baseSalary),
    maritalStatus: staff.maritalStatus as MaritalStatus | null,
    spouseWorking: staff.spouseWorking,
    childCount: staff.childCount,
    isSocsoSecondCategory: staff.isSocsoSecondCategory,
    lindung24JamOptOut: staff.lindung24JamOptOut,
    year: input.year,
    month: input.month,
    pcbYtdBeforeMonth,
    pcbLocked: false,
    pcbFinal: null,
    monthOverrides: {
      epfEmployeeOverride: null,
      epfEmployerOverride: null,
      socsoEmployeeOverride: null,
      socsoEmployerOverride: null,
      eisEmployeeOverride: null,
      eisEmployerOverride: null,
      pcbOverride: null,
      lindung24JamOverride: null,
    },
  }).statutory;

  return {
    yearMonth,
    year: input.year,
    month: input.month,
    staff: serializeStaff(staff),
    payrollMonthId: record.id,
    overrides: {
      epfEmployee: decimalToNumber(record.epfEmployeeOverride),
      epfEmployer: decimalToNumber(record.epfEmployerOverride),
      socsoEmployee: decimalToNumber(record.socsoEmployeeOverride),
      socsoEmployer: decimalToNumber(record.socsoEmployerOverride),
      eisEmployee: decimalToNumber(record.eisEmployeeOverride),
      eisEmployer: decimalToNumber(record.eisEmployerOverride),
      pcb: decimalToNumber(record.pcbOverride),
      lindung24Jam: decimalToNumber(record.lindung24JamOverride),
    },
    summary,
    autoStatutory,
  };
}

export async function saveStaffPayrollOverrides(input: {
  payrollMonthId: string;
  epfEmployee?: number | null;
  epfEmployer?: number | null;
  socsoEmployee?: number | null;
  socsoEmployer?: number | null;
  eisEmployee?: number | null;
  eisEmployer?: number | null;
  pcb?: number | null;
  lindung24Jam?: number | null;
}) {
  const user = await requireStaffPayrollWriteAccess();
  const { applyStaffPayrollOverridePatch } = await import(
    "@/lib/staff-payroll-override-write"
  );
  await applyStaffPayrollOverridePatch({
    payrollMonthId: input.payrollMonthId,
    actorUserId: user.id,
    epfEmployee: input.epfEmployee,
    epfEmployer: input.epfEmployer,
    socsoEmployee: input.socsoEmployee,
    socsoEmployer: input.socsoEmployer,
    eisEmployee: input.eisEmployee,
    eisEmployer: input.eisEmployer,
    pcb: input.pcb,
    lindung24Jam: input.lindung24Jam,
  });
  revalidatePath("/staff-payroll");
}

export async function getStaffPayslipPrintData(input: {
  staffId: string;
  year: number;
  month: number;
}) {
  await requireStaffPayrollAccess();
  const { isStaffEligibleForPayrollMonth } = await import(
    "@/lib/staff-payroll-month"
  );
  const staff = await prisma.staff.findUnique({ where: { id: input.staffId } });
  if (
    !staff ||
    !isStaffEligibleForPayrollMonth(staff, input.year, input.month)
  ) {
    return null;
  }

  const monthData = await getStaffPayrollMonth(input);
  return {
    year: monthData.year,
    month: monthData.month,
    yearMonth: monthData.yearMonth,
    staff: {
      name: monthData.staff.name,
      nickname: monthData.staff.nickname,
      icNumber: monthData.staff.icNumber,
      bankName: monthData.staff.bankName,
      bankAccount: monthData.staff.bankAccount,
      baseSalary: monthData.staff.baseSalary,
    },
    summary: monthData.summary,
  };
}

export async function getBatchStaffPayslipPrintData(input: {
  year: number;
  month: number;
}) {
  await requireStaffPayrollAccess();
  const staffList = await getStaffPayrollStaff(input);
  const entries = [];
  for (const s of staffList) {
    const data = await getStaffPayslipPrintData({
      staffId: s.id,
      year: input.year,
      month: input.month,
    });
    if (!data) continue;
    entries.push({
      staffId: s.id,
      staff: data.staff,
      summary: data.summary,
    });
  }
  return {
    year: input.year,
    month: input.month,
    yearMonth: `${input.year}-${String(input.month).padStart(2, "0")}`,
    entries,
  };
}

async function requireStaffPayrollJvExportAccess() {
  const user = await requireStaffPayrollAccess();
  const { canExportStaffPayrollJv } = await import("@/lib/auth-roles");
  if (!canExportStaffPayrollJv(user.role as UserRole)) {
    throw new Error("无 JV 导出权限 JV export access denied");
  }
  return user;
}

export async function getStaffPayrollJvPreview(input: {
  year: number;
  month: number;
}) {
  await requireStaffPayrollJvExportAccess();
  const { buildMonthlyStaffJvRows } = await import(
    "@/lib/staff-payroll-jv-export"
  );
  return buildMonthlyStaffJvRows(input.year, input.month);
}

export async function exportStaffPayrollJvCsvAction(input: {
  year: number;
  month: number;
}) {
  await requireStaffPayrollJvExportAccess();
  const {
    buildMonthlyStaffJvRows,
    generateStaffPayrollJvCsv,
    staffPayrollJvCsvFilename,
  } = await import("@/lib/staff-payroll-jv-export");
  const result = await buildMonthlyStaffJvRows(input.year, input.month);
  const content = generateStaffPayrollJvCsv(result);
  return {
    filename: staffPayrollJvCsvFilename(input.year, input.month),
    content,
  };
}
