import { describe, expect, it } from "vitest";
import { payslipWagesTotal } from "@/lib/driver-payslip";
import {
  assertTripListingWagesMatchPayslip,
  buildTripListingRows,
  tripListingWagesTotal,
} from "@/lib/driver-trip-listing";
import { buildDriverPayrollSummaryFromRecords } from "@/lib/payroll-fleet";
import type { PayrollSummary } from "@/lib/payroll-statutory";

function akimJuneSummary(): PayrollSummary {
  return {
    baseSalary: 1700,
    tripAllowanceTotal: 2400,
    charterSalaryTotal: 0,
    crateCommissionTotal: 500,
    crateMultiMarketTotal: 30,
    extraAllowanceTotal: 0,
    advanceTotal: 1800,
    grossSalary: 4630,
    statutory: {
      epfEmployee: 509.3,
      epfEmployer: 601.9,
      socsoEmployee: 23.25,
      socsoEmployer: 81.35,
      lindung24Jam: 34.85,
      eisEmployee: 9.26,
      eisEmployer: 9.26,
      pcb: 0,
    },
    netSalary: 2253.34,
  };
}

describe("buildTripListingRows", () => {
  it("merges crate commission + multi-market per trip (530 display)", () => {
    const rows = buildTripListingRows({
      trips: [
        {
          charterTripId: null,
          date: "2026-06-15",
          route: "KL",
          markets: ["A", "BM", "P"],
          tripAllowance: 300,
          charterSalary: 0,
          extraAllowance: 0,
          crateReturnCommission: 50,
          crateReturnMultiMarketAllowance: 30,
          plate: "PQK 6398",
          charterDestination: null,
          sortOrder: 0,
        },
      ],
      extras: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].crateCommission).toBe(80);
    expect(rows[0].subtotal).toBe(380);
  });

  it("uses charter salary in trip wages column for CH rows", () => {
    const rows = buildTripListingRows({
      trips: [
        {
          charterTripId: "charter-1",
          date: "2026-06-10",
          route: "包车 Charter",
          markets: [],
          tripAllowance: 0,
          charterSalary: 500,
          extraAllowance: 0,
          crateReturnCommission: 50,
          crateReturnMultiMarketAllowance: 0,
          plate: "ABC 1234",
          charterDestination: "Penang",
          sortOrder: 0,
        },
      ],
      extras: [],
    });

    expect(rows[0].type).toBe("CH");
    expect(rows[0].tripAllowance).toBe(500);
    expect(rows[0].marketRoute).toBe("Penang");
    expect(rows[0].subtotal).toBe(550);
  });

  it("includes extra_allowance extras as ALLOW rows in total wages", () => {
    const rows = buildTripListingRows({
      trips: [
        {
          charterTripId: null,
          date: "2026-06-01",
          route: "KL",
          markets: ["KL"],
          tripAllowance: 240,
          charterSalary: 0,
          extraAllowance: 0,
          crateReturnCommission: 0,
          crateReturnMultiMarketAllowance: 0,
          plate: "PLATE",
          charterDestination: null,
          sortOrder: 0,
        },
      ],
      extras: [
        {
          type: "extra_allowance",
          amount: 100,
          note: "Bonus",
          date: "2026-06-20",
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(tripListingWagesTotal(rows)).toBe(340);
  });
});

describe("assertTripListingWagesMatchPayslip", () => {
  it("passes when listing total equals Akim June payslip WAGES (2930)", () => {
    const summary = akimJuneSummary();
    expect(payslipWagesTotal(summary)).toBe(2930);

    const rows = buildTripListingRows({
      trips: [
        {
          charterTripId: null,
          date: "2026-06-01",
          route: "KL",
          markets: ["KL"],
          tripAllowance: 2400,
          charterSalary: 0,
          extraAllowance: 0,
          crateReturnCommission: 500,
          crateReturnMultiMarketAllowance: 30,
          plate: "PLATE",
          charterDestination: null,
          sortOrder: 0,
        },
      ],
      extras: [],
    });

    expect(() => assertTripListingWagesMatchPayslip(rows, summary)).not.toThrow();
    expect(tripListingWagesTotal(rows)).toBe(2930);
  });

  it("passes for Fook June rev4 wages (2810) with split trips", () => {
    const summary: PayrollSummary = {
      ...akimJuneSummary(),
      tripAllowanceTotal: 2460,
      crateCommissionTotal: 350,
      crateMultiMarketTotal: 0,
      grossSalary: 4510,
      advanceTotal: 1500,
      netSalary: 2479.75,
      statutory: {
        epfEmployee: 496.1,
        epfEmployer: 586.3,
        socsoEmployee: 0,
        socsoEmployer: 56.9,
        lindung24Jam: 34.15,
        eisEmployee: 0,
        eisEmployer: 0,
        pcb: 0,
      },
    };
    expect(payslipWagesTotal(summary)).toBe(2810);

    const rows = buildTripListingRows({
      trips: [
        {
          charterTripId: null,
          date: "2026-06-01",
          route: "BM",
          markets: ["BM"],
          tripAllowance: 2000,
          charterSalary: 0,
          extraAllowance: 0,
          crateReturnCommission: 200,
          crateReturnMultiMarketAllowance: 0,
          plate: "P1",
          charterDestination: null,
          sortOrder: 0,
        },
        {
          charterTripId: null,
          date: "2026-06-15",
          route: "KL",
          markets: ["KL"],
          tripAllowance: 460,
          charterSalary: 0,
          extraAllowance: 0,
          crateReturnCommission: 150,
          crateReturnMultiMarketAllowance: 0,
          plate: "P2",
          charterDestination: null,
          sortOrder: 1,
        },
      ],
      extras: [],
    });

    expect(() => assertTripListingWagesMatchPayslip(rows, summary)).not.toThrow();
  });

  it("throws when listing total does not match payslip WAGES", () => {
    const summary = akimJuneSummary();
    const rows = buildTripListingRows({
      trips: [
        {
          charterTripId: null,
          date: "2026-06-01",
          route: "KL",
          markets: ["KL"],
          tripAllowance: 1000,
          charterSalary: 0,
          extraAllowance: 0,
          crateReturnCommission: 0,
          crateReturnMultiMarketAllowance: 0,
          plate: "P",
          charterDestination: null,
          sortOrder: 0,
        },
      ],
      extras: [],
    });

    expect(() => assertTripListingWagesMatchPayslip(rows, summary)).toThrow(
      /does not match payslip WAGES/
    );
  });
});

describe("trip listing vs payroll summary from records", () => {
  it("matches payslip wages for composite trip + trip extra allowance", () => {
    const driver = {
      id: "d1",
      name: "Test",
      baseSalary: 1700,
      maritalStatus: null as const,
      childCount: 0,
      isSocsoSecondCategory: false,
    };
    const summary = buildDriverPayrollSummaryFromRecords({
      driver,
      trips: [
        {
          tripAllowance: 240,
          charterSalary: 0,
          extraAllowance: 50,
          crateReturnCommission: 50,
          crateReturnMultiMarketAllowance: 30,
        },
      ],
      extras: [],
    });

    const rows = buildTripListingRows({
      trips: [
        {
          charterTripId: null,
          date: "2026-06-01",
          route: "KL",
          markets: ["KL"],
          tripAllowance: 240,
          charterSalary: 0,
          extraAllowance: 50,
          crateReturnCommission: 50,
          crateReturnMultiMarketAllowance: 30,
          plate: "X",
          charterDestination: null,
          sortOrder: 0,
        },
      ],
      extras: [],
    });

    assertTripListingWagesMatchPayslip(rows, summary);
  });
});
