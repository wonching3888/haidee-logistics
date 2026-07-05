import { describe, expect, it } from "vitest";
import {
  isPcbAutoCalcMonth,
  resolvePayrollPcb,
  emptyPcbYtd,
  PCB_AUTO_CALC_FROM_YEAR_MONTH,
} from "@/lib/pcb-policy";

describe("isPcbAutoCalcMonth", () => {
  it("starts from 2026-07", () => {
    expect(PCB_AUTO_CALC_FROM_YEAR_MONTH).toBe("2026-07");
    expect(isPcbAutoCalcMonth(2026, 6)).toBe(false);
    expect(isPcbAutoCalcMonth(2026, 7)).toBe(true);
    expect(isPcbAutoCalcMonth(2026, 8)).toBe(true);
  });
});

describe("resolvePayrollPcb priority", () => {
  const base = {
    year: 2026,
    month: 7,
    grossSalary: 4630,
    epfEmployee: 511,
    maritalStatus: "married" as const,
    spouseWorking: true,
    childCount: 2,
    ytdBeforeMonth: emptyPcbYtd(),
  };

  it("override wins over auto", () => {
    const r = resolvePayrollPcb({ ...base, pcbOverride: 12.34 });
    expect(r.source).toBe("override");
    expect(r.pcb).toBe(12.34);
  });

  it("locked final wins when no override", () => {
    const r = resolvePayrollPcb({
      ...base,
      pcbLocked: true,
      pcbFinal: 55.55,
    });
    expect(r.source).toBe("locked");
    expect(r.pcb).toBe(55.55);
  });

  it("override wins over locked", () => {
    const r = resolvePayrollPcb({
      ...base,
      pcbOverride: 9.99,
      pcbLocked: true,
      pcbFinal: 55.55,
    });
    expect(r.source).toBe("override");
    expect(r.pcb).toBe(9.99);
  });

  it("pre-July without override is 0", () => {
    const r = resolvePayrollPcb({
      ...base,
      year: 2026,
      month: 6,
    });
    expect(r.source).toBe("none");
    expect(r.pcb).toBe(0);
  });

  it("July auto uses engine (not hard-coded 0)", () => {
    // End-of-June YTD (after June accounting roll) as July opening.
    const r = resolvePayrollPcb({
      ...base,
      ytdBeforeMonth: {
        accumulatedGrossY: 36230,
        accumulatedEpfK: 4020,
        accumulatedMtdX: 1071.75,
        accumulatedZakatZ: 0,
      },
    });
    expect(r.source).toBe("auto");
    expect(r.pcb).toBeGreaterThan(0);
    expect(r.pcb).toBe(36.2);
  });
});
