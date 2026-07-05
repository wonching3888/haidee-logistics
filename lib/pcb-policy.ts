/**
 * PCB auto-calc policy (no DB). Production wiring from 2026-07.
 */
import { calculateMonthlyPcb, type PcbYearToDate } from "@/lib/pcb-calculation";
import { derivePcbNeedsReview } from "@/lib/driver-pcb-profile";
import type { MaritalStatus } from "@/lib/constants/payroll";

/** First payroll month where auto PCB engine is used (inclusive). */
export const PCB_AUTO_CALC_FROM_YEAR_MONTH = "2026-07";

export function parsePayrollYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function priorPayrollYearMonth(year: number, month: number) {
  if (month <= 1) return parsePayrollYearMonth(year - 1, 12);
  return parsePayrollYearMonth(year, month - 1);
}

export function isPcbAutoCalcMonth(year: number, month: number) {
  return parsePayrollYearMonth(year, month) >= PCB_AUTO_CALC_FROM_YEAR_MONTH;
}

export function emptyPcbYtd(): PcbYearToDate {
  return {
    accumulatedGrossY: 0,
    accumulatedEpfK: 0,
    accumulatedMtdX: 0,
    accumulatedZakatZ: 0,
  };
}

/**
 * Resolve PCB for a payroll month.
 * Priority: pcbOverride > locked pcbFinal > auto engine (from July) > 0.
 */
export function resolvePayrollPcb(input: {
  year: number;
  month: number;
  grossSalary: number;
  epfEmployee: number;
  maritalStatus: MaritalStatus | null | undefined;
  spouseWorking?: boolean | null;
  childCount: number;
  ytdBeforeMonth: PcbYearToDate;
  pcbOverride?: number | null;
  pcbLocked?: boolean;
  pcbFinal?: number | null;
}): {
  pcb: number;
  pcbComputed: number | null;
  source: "override" | "locked" | "auto" | "none";
} {
  if (input.pcbOverride != null) {
    return { pcb: input.pcbOverride, pcbComputed: null, source: "override" };
  }
  if (input.pcbLocked && input.pcbFinal != null) {
    return {
      pcb: input.pcbFinal,
      pcbComputed: input.pcbFinal,
      source: "locked",
    };
  }

  if (!isPcbAutoCalcMonth(input.year, input.month)) {
    return { pcb: 0, pcbComputed: null, source: "none" };
  }

  const complete = !derivePcbNeedsReview({
    maritalStatus: input.maritalStatus,
    spouseWorking: input.spouseWorking,
  });

  const result = calculateMonthlyPcb({
    grossSalary: input.grossSalary,
    epfEmployee: input.epfEmployee,
    maritalStatus: input.maritalStatus,
    spouseWorking: input.spouseWorking,
    childCount: input.childCount,
    month: input.month,
    accumulatedGrossY: input.ytdBeforeMonth.accumulatedGrossY,
    accumulatedEpfK: input.ytdBeforeMonth.accumulatedEpfK,
    accumulatedMtdX: input.ytdBeforeMonth.accumulatedMtdX,
    accumulatedZakatZ: input.ytdBeforeMonth.accumulatedZakatZ,
    pcbMaritalDataVerified: complete,
  });

  return { pcb: result.pcb, pcbComputed: result.pcb, source: "auto" };
}
