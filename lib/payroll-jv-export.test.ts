import { describe, expect, it } from "vitest";
import { canExportPayrollJv } from "@/lib/auth-roles";
import {
  buildDriverJvFromSummary,
  generatePayrollJvCsv,
  type MonthlyPayrollJvResult,
} from "@/lib/payroll-jv-export";
import type { PayrollSummary } from "@/lib/payroll-statutory";

function akimJuneSummary(): PayrollSummary {
  return {
    baseSalary: 1700,
    tripAllowanceTotal: 3000,
    charterSalaryTotal: 0,
    crateCommissionTotal: 170,
    extraAllowanceTotal: 100,
    advanceTotal: 2000,
    grossSalary: 4970,
    statutory: {
      epfEmployee: 546.7,
      epfEmployer: 646.1,
      socsoEmployee: 17.5,
      socsoEmployer: 34.3,
      eisEmployee: 10.04,
      eisEmployer: 38.44,
      pcb: 0,
    },
    netSalary: 2395.76,
  };
}

describe("payroll JV export permissions", () => {
  it("allows admin and my_accounting only", () => {
    expect(canExportPayrollJv("admin")).toBe(true);
    expect(canExportPayrollJv("my_accounting")).toBe(true);
    expect(canExportPayrollJv("clerk")).toBe(false);
    expect(canExportPayrollJv("viewer")).toBe(false);
  });
});

describe("buildDriverJvFromSummary", () => {
  it("builds balanced AKIM June JV with correct account codes and totals", () => {
    const jv = buildDriverJvFromSummary({
      driver: {
        id: "akim-id",
        name: "Akim",
        fullName: "Muhammad Hakim Bin Mat Sarip",
        accountCodeSuffix: "AKIM",
      },
      summary: akimJuneSummary(),
      jvNo: "JV-2606-009",
      jvDate: "2026-06-30",
    });

    expect(jv.balanced).toBe(true);
    expect(jv.debitTotal).toBe(5688.84);
    expect(jv.creditTotal).toBe(5688.84);
    expect(jv.amounts).toMatchObject({
      baseSalary: 1700,
      wages: 3270,
      epfEmployer: 646.1,
      socsoEisEmployer: 72.74,
      epfPayable: 1192.8,
      socsoEisPayable: 100.28,
      pcb: 0,
      advance: 2000,
      netSalary: 2395.76,
    });

    const byAccount = Object.fromEntries(
      jv.lines.map((line) => [
        line.accountCode,
        { debit: line.debit, credit: line.credit },
      ])
    );

    expect(byAccount["6308-AKIM"]).toEqual({ debit: 1700, credit: 0 });
    expect(byAccount["6307-AKIM"]).toEqual({ debit: 3270, credit: 0 });
    expect(byAccount["9005-AKIM"]).toEqual({ debit: 646.1, credit: 0 });
    expect(byAccount["9006-AKIM"]).toEqual({ debit: 72.74, credit: 0 });
    expect(byAccount["4101-0000"]).toEqual({ debit: 0, credit: 1192.8 });
    expect(byAccount["4102-0000"]).toEqual({ debit: 0, credit: 100.28 });
    expect(byAccount["4103-0000"]).toBeUndefined();
    expect(byAccount["3301-AKIM"]).toEqual({ debit: 0, credit: 2000 });
    expect(byAccount["4104-AKIM"]).toEqual({ debit: 0, credit: 2395.76 });
  });

  it("omits zero-amount lines including PCB", () => {
    const jv = buildDriverJvFromSummary({
      driver: {
        id: "1",
        name: "Akim",
        fullName: null,
        accountCodeSuffix: "AKIM",
      },
      summary: akimJuneSummary(),
      jvNo: "JV-2606-001",
      jvDate: "2026-06-30",
    });

    expect(jv.lines.some((line) => line.accountCode === "4103-0000")).toBe(
      false
    );
    expect(jv.lines.every((line) => line.debit > 0 || line.credit > 0)).toBe(
      true
    );
  });

  it("flags imbalance when amounts do not tie out", () => {
    const summary = akimJuneSummary();
    summary.netSalary = 2000;

    const jv = buildDriverJvFromSummary({
      driver: {
        id: "1",
        name: "Akim",
        fullName: null,
        accountCodeSuffix: "AKIM",
      },
      summary,
      jvNo: "JV-2606-001",
      jvDate: "2026-06-30",
    });

    expect(jv.balanced).toBe(false);
    expect(Math.abs(jv.imbalance)).toBeGreaterThan(0.01);
  });
});

describe("generatePayrollJvCsv", () => {
  it("throws when any driver JV is unbalanced", () => {
    const result: MonthlyPayrollJvResult = {
      year: 2026,
      month: 6,
      yearMonth: "2026-06",
      jvDate: "2026-06-30",
      drivers: [],
      skippedDrivers: [],
      imbalancedDrivers: [
        {
          driverId: "1",
          driverName: "Akim",
          jvNo: "JV-2606-001",
          debitTotal: 100,
          creditTotal: 90,
          imbalance: 10,
        },
      ],
      allBalanced: false,
      flatLines: [],
    };

    expect(() => generatePayrollJvCsv(result)).toThrow(/不平衡|Unbalanced/i);
  });

  it("outputs UTF-8 BOM CSV with escaped headers and amounts", () => {
    const jv = buildDriverJvFromSummary({
      driver: {
        id: "1",
        name: "Akim",
        fullName: null,
        accountCodeSuffix: "AKIM",
      },
      summary: akimJuneSummary(),
      jvNo: "JV-2606-001",
      jvDate: "2026-06-30",
    });

    const csv = generatePayrollJvCsv({
      year: 2026,
      month: 6,
      yearMonth: "2026-06",
      jvDate: "2026-06-30",
      drivers: [jv],
      skippedDrivers: [],
      imbalancedDrivers: [],
      allBalanced: true,
      flatLines: jv.lines,
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("日期 Date,JV号 JVNo,科目码 AccountCode,借 Debit,贷 Credit,备注 Description");
    expect(csv).toContain("JV-2606-001,6308-AKIM,1700.00,,");
    expect(csv).toContain(",4104-AKIM,,2395.76,");
  });
});

describe("buildMonthlyDriverJvRows integration", () => {
  it(
    "balances every exportable driver JV for June 2026 when DB is available",
    async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const { buildMonthlyDriverJvRows } = await import("@/lib/payroll-jv-export");
      const result = await buildMonthlyDriverJvRows(2026, 6);

      expect(result.drivers.length).toBeGreaterThan(0);
      expect(result.allBalanced).toBe(true);
      expect(result.imbalancedDrivers).toHaveLength(0);
      expect(result.drivers[0]?.jvNo).toBe("JV-2606-001");
      expect(result.drivers.at(-1)?.jvNo).toBe(
        `JV-2606-${String(result.drivers.length).padStart(3, "0")}`
      );

      for (const jv of result.drivers) {
        expect(jv.balanced).toBe(true);
        expect(jv.debitTotal).toBe(jv.creditTotal);
      }
    },
    60000
  );

  it(
    "matches AKIM June JV lines and payroll-page totals from DB",
    async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const { buildMonthlyDriverJvRows } = await import("@/lib/payroll-jv-export");
      const { buildDriverPayrollSummaryFromRecords } = await import(
        "@/lib/payroll-fleet"
      );
      const { prisma } = await import("@/lib/prisma");
      const { decimalToNumber } = await import("@/lib/freight-rates");

      const result = await buildMonthlyDriverJvRows(2026, 6);
      const akimJv = result.drivers.find(
        (row) => row.accountCodeSuffix === "AKIM"
      );
      expect(akimJv).toBeDefined();
      expect(akimJv!.balanced).toBe(true);
      expect(akimJv!.debitTotal).toBe(akimJv!.creditTotal);

      const driver = await prisma.driver.findFirst({
        where: { name: "Akim", active: true },
        include: {
          payrollMonths: {
            where: { yearMonth: "2026-06" },
            include: { trips: true, extras: true },
          },
        },
      });
      expect(driver?.accountCodeSuffix).toBe("AKIM");

      const monthRecord = driver?.payrollMonths[0];
      const summary = buildDriverPayrollSummaryFromRecords({
        driver: {
          id: driver!.id,
          name: driver!.name,
          baseSalary: decimalToNumber(driver!.baseSalary),
          maritalStatus: driver!.maritalStatus as "single" | "married" | null,
          childCount: driver!.childCount,
        },
        trips: monthRecord?.trips ?? [],
        extras: monthRecord?.extras ?? [],
        overrides: monthRecord,
      });

      expect(akimJv!.amounts.baseSalary).toBe(summary.baseSalary);
      expect(akimJv!.amounts.wages).toBe(
        summary.tripAllowanceTotal +
          summary.charterSalaryTotal +
          summary.crateCommissionTotal +
          summary.extraAllowanceTotal
      );
      expect(akimJv!.amounts.netSalary).toBe(summary.netSalary);
      expect(akimJv!.amounts.advance).toBe(summary.advanceTotal);
      expect(akimJv!.amounts.epfEmployer).toBe(summary.statutory.epfEmployer);
      expect(akimJv!.amounts.epfPayable).toBe(
        summary.statutory.epfEmployee + summary.statutory.epfEmployer
      );

      const codes = akimJv!.lines.map((line) => line.accountCode);
      expect(codes).toContain("6308-AKIM");
      expect(codes).toContain("6307-AKIM");
      expect(codes).toContain("9005-AKIM");
      expect(codes).toContain("9006-AKIM");
      expect(codes).toContain("4101-0000");
      expect(codes).toContain("4102-0000");
      expect(codes).not.toContain("4103-0000");
      expect(codes).toContain("3301-AKIM");
      expect(codes).toContain("4104-AKIM");
    },
    60000
  );
});
