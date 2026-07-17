/**
 * Staff PCB year-to-date balances (DB layer).
 * Mirrored from lib/pcb-ytd-balance.ts — staffId / staffPcbYtdBalance only.
 */
import type { PcbYearToDate } from "@/lib/pcb-calculation";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

export async function loadPcbYtdBalancesAsOf(
  asOfYearMonth: string
): Promise<Map<string, PcbYearToDate>> {
  const rows = await prisma.staffPcbYtdBalance.findMany({
    where: { asOfYearMonth },
  });
  const map = new Map<string, PcbYearToDate>();
  for (const row of rows) {
    map.set(row.staffId, {
      accumulatedGrossY: decimalToNumber(row.accumulatedGrossY) ?? 0,
      accumulatedEpfK: decimalToNumber(row.accumulatedEpfK) ?? 0,
      accumulatedMtdX: decimalToNumber(row.accumulatedMtdX) ?? 0,
      accumulatedZakatZ: decimalToNumber(row.accumulatedZakatZ) ?? 0,
    });
  }
  return map;
}

export async function upsertPcbYtdBalance(input: {
  staffId: string;
  asOfYearMonth: string;
  balance: PcbYearToDate;
  source: "seed" | "lock" | "manual";
}) {
  const existing = await prisma.staffPcbYtdBalance.findUnique({
    where: {
      staffId_asOfYearMonth: {
        staffId: input.staffId,
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
    return prisma.staffPcbYtdBalance.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.staffPcbYtdBalance.create({
    data: {
      id: randomUUID(),
      staffId: input.staffId,
      asOfYearMonth: input.asOfYearMonth,
      ...data,
    },
  });
}
