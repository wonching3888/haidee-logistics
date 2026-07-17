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
