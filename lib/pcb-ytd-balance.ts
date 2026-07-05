/**
 * PCB year-to-date balances and monthly lock snapshots (DB layer).
 */
import { advancePcbYearToDate, type PcbYearToDate } from "@/lib/pcb-calculation";
import {
  emptyPcbYtd,
  parsePayrollYearMonth,
  priorPayrollYearMonth,
  resolvePayrollPcb,
} from "@/lib/pcb-policy";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

export {
  PCB_AUTO_CALC_FROM_YEAR_MONTH,
  emptyPcbYtd,
  isPcbAutoCalcMonth,
  parsePayrollYearMonth,
  priorPayrollYearMonth,
  resolvePayrollPcb,
} from "@/lib/pcb-policy";

export async function loadPcbYtdBalancesAsOf(
  asOfYearMonth: string
): Promise<Map<string, PcbYearToDate>> {
  const rows = await prisma.driverPcbYtdBalance.findMany({
    where: { asOfYearMonth },
  });
  const map = new Map<string, PcbYearToDate>();
  for (const row of rows) {
    map.set(row.driverId, {
      accumulatedGrossY: decimalToNumber(row.accumulatedGrossY) ?? 0,
      accumulatedEpfK: decimalToNumber(row.accumulatedEpfK) ?? 0,
      accumulatedMtdX: decimalToNumber(row.accumulatedMtdX) ?? 0,
      accumulatedZakatZ: decimalToNumber(row.accumulatedZakatZ) ?? 0,
    });
  }
  return map;
}

export async function upsertPcbYtdBalance(input: {
  driverId: string;
  asOfYearMonth: string;
  balance: PcbYearToDate;
  source: "seed" | "lock" | "manual";
}) {
  const existing = await prisma.driverPcbYtdBalance.findUnique({
    where: {
      driverId_asOfYearMonth: {
        driverId: input.driverId,
        asOfYearMonth: input.asOfYearMonth,
      },
    },
  });

  const data = {
    accumulatedGrossY: input.balance.accumulatedGrossY,
    accumulatedEpfK: input.balance.accumulatedEpfK,
    accumulatedMtdX: input.balance.accumulatedMtdX,
    accumulatedZakatZ: input.balance.accumulatedZakatZ,
    source: input.source,
  };

  if (existing) {
    return prisma.driverPcbYtdBalance.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.driverPcbYtdBalance.create({
    data: {
      id: randomUUID(),
      driverId: input.driverId,
      asOfYearMonth: input.asOfYearMonth,
      ...data,
    },
  });
}

export async function deletePcbYtdBalancesAsOf(asOfYearMonth: string) {
  return prisma.driverPcbYtdBalance.deleteMany({ where: { asOfYearMonth } });
}

/**
 * Lock a payroll month's PCB: freeze inputs/result and advance YTD balance
 * for asOfYearMonth = this month (opening for next month).
 */
export async function lockPayrollMonthPcb(input: {
  driverId: string;
  year: number;
  month: number;
  monthGross: number;
  monthEpf: number;
  maritalStatus: MaritalStatus | null | undefined;
  spouseWorking?: boolean | null;
  childCount: number;
  pcbOverride?: number | null;
}) {
  const yearMonth = parsePayrollYearMonth(input.year, input.month);
  const priorYm = priorPayrollYearMonth(input.year, input.month);
  const balances = await loadPcbYtdBalancesAsOf(priorYm);
  const ytdBefore = balances.get(input.driverId) ?? emptyPcbYtd();

  const resolved = resolvePayrollPcb({
    year: input.year,
    month: input.month,
    grossSalary: input.monthGross,
    epfEmployee: input.monthEpf,
    maritalStatus: input.maritalStatus,
    spouseWorking: input.spouseWorking,
    childCount: input.childCount,
    ytdBeforeMonth: ytdBefore,
    pcbOverride: input.pcbOverride,
  });

  const monthRecord = await prisma.driverPayrollMonth.findUnique({
    where: {
      driverId_yearMonth: { driverId: input.driverId, yearMonth },
    },
  });
  if (!monthRecord) {
    throw new Error(`No payroll month ${yearMonth} for driver ${input.driverId}`);
  }
  if (monthRecord.pcbLocked) {
    throw new Error(`Payroll month ${yearMonth} PCB already locked`);
  }

  await prisma.driverPayrollMonth.update({
    where: { id: monthRecord.id },
    data: {
      pcbComputed: resolved.pcbComputed,
      pcbFinal: resolved.pcb,
      pcbLocked: true,
      pcbLockedAt: new Date(),
      pcbSnapshotYtdGross: ytdBefore.accumulatedGrossY,
      pcbSnapshotYtdEpf: ytdBefore.accumulatedEpfK,
      pcbSnapshotYtdMtd: ytdBefore.accumulatedMtdX,
      pcbSnapshotMonthGross: input.monthGross,
      pcbSnapshotMonthEpf: input.monthEpf,
    },
  });

  const ytdAfter = advancePcbYearToDate(ytdBefore, {
    grossSalary: input.monthGross,
    epfEmployee: input.monthEpf,
    pcb: resolved.pcb,
  });

  await upsertPcbYtdBalance({
    driverId: input.driverId,
    asOfYearMonth: yearMonth,
    balance: ytdAfter,
    source: "lock",
  });

  return { pcb: resolved.pcb, source: resolved.source, ytdAfter };
}
