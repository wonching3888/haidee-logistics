import { describe, expect, it } from "vitest";
import {
  isPayrollSyncLag,
  scanOperationsPayrollWarnings,
} from "@/lib/operations-payroll-warnings";

const allowanceContext = {
  routes: [
    {
      code: "BM",
      markets: ["BM"],
      driverAllowance: 100,
      displayOrder: 1,
    },
  ],
  extraMarketAllowance: 50,
  bigTruckCrateCommission: 210,
  smallTruckCrateCommission: 190,
  bpCrateCommissionBigTruck: 210,
  bpCrateCommissionSmallTruck: 190,
} as never;

const drivers = [
  {
    id: "driver-1",
    name: "Ali",
    fullName: null,
    nickname: null,
  },
];

function baseScanInput(overrides?: Partial<Parameters<typeof scanOperationsPayrollWarnings>[0]>) {
  return {
    year: 2026,
    month: 6,
    now: new Date("2026-06-16T12:00:00.000Z"),
    drivers,
    allowanceContext,
    dispatches: [],
    charters: [],
    imports: [],
    assignedInboundLines: [],
    ...overrides,
  };
}

describe("isPayrollSyncLag", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");

  it("treats trips within 2 calendar days as sync lag", () => {
    expect(
      isPayrollSyncLag(new Date("2026-06-16T00:00:00.000Z"), new Date("2026-06-01T00:00:00.000Z"), now)
    ).toBe(true);
    expect(
      isPayrollSyncLag(new Date("2026-06-15T00:00:00.000Z"), new Date("2026-06-01T00:00:00.000Z"), now)
    ).toBe(true);
    expect(
      isPayrollSyncLag(new Date("2026-06-14T00:00:00.000Z"), new Date("2026-06-01T00:00:00.000Z"), now)
    ).toBe(true);
    expect(
      isPayrollSyncLag(new Date("2026-06-13T00:00:00.000Z"), new Date("2026-06-01T00:00:00.000Z"), now)
    ).toBe(false);
  });

  it("treats entities created within 24h as sync lag", () => {
    expect(
      isPayrollSyncLag(
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-16T08:00:00.000Z"),
        now
      )
    ).toBe(true);
  });
});

describe("scanOperationsPayrollWarnings", () => {
  it("counts P1 missing payroll row as active warning for older trips", () => {
    const result = scanOperationsPayrollWarnings(
      baseScanInput({
        dispatches: [
          {
            id: "d1",
            dispatchNo: "DO-001",
            date: new Date("2026-06-10T00:00:00.000Z"),
            createdAt: new Date("2026-06-10T08:00:00.000Z"),
            driverName: "Ali",
            markets: ["BM"],
            truckId: "truck-1",
            truck: { plate: "ABC1234", type: "big" },
            lines: [],
            payrollTrip: null,
          },
        ],
      })
    );

    expect(result.rules.find((r) => r.key === "p1")?.count).toBe(1);
    expect(result.activeWarningCount).toBe(1);
    expect(result.unsyncedCount).toBe(0);
  });

  it("routes recent trips to unsynced instead of P1", () => {
    const result = scanOperationsPayrollWarnings(
      baseScanInput({
        dispatches: [
          {
            id: "d1",
            dispatchNo: "DO-002",
            date: new Date("2026-06-16T00:00:00.000Z"),
            createdAt: new Date("2026-06-16T08:00:00.000Z"),
            driverName: "Ali",
            markets: ["BM"],
            truckId: "truck-1",
            truck: { plate: "ABC1234", type: "big" },
            lines: [],
            payrollTrip: null,
          },
        ],
      })
    );

    expect(result.rules.find((r) => r.key === "p1")).toBeUndefined();
    expect(result.unsyncedCount).toBe(1);
    expect(result.activeWarningCount).toBe(0);
    expect(result.showBox).toBe(true);
  });

  it("detects P2 trip allowance gap when payroll row exists", () => {
    const result = scanOperationsPayrollWarnings(
      baseScanInput({
        dispatches: [
          {
            id: "d1",
            dispatchNo: "DO-003",
            date: new Date("2026-06-10T00:00:00.000Z"),
            createdAt: new Date("2026-06-10T08:00:00.000Z"),
            driverName: "Ali",
            markets: ["BM"],
            truckId: "truck-1",
            truck: { plate: "ABC1234", type: "big" },
            lines: [],
            payrollTrip: {
              tripAllowance: 0,
              crateReturnCommission: 0,
              charterSalary: 0,
            },
          },
        ],
      })
    );

    expect(result.rules.find((r) => r.key === "p2")?.count).toBe(1);
    expect(result.rules.find((r) => r.key === "p2")?.sumExpected).toBe(100);
  });

  it("detects P4 charter salary gap", () => {
    const result = scanOperationsPayrollWarnings(
      baseScanInput({
        charters: [
          {
            id: "c1",
            charterNo: "CH-001",
            date: new Date("2026-06-10T00:00:00.000Z"),
            createdAt: new Date("2026-06-10T08:00:00.000Z"),
            driverName: "Ali",
            truckId: "truck-1",
            charterDriverSalaryMyr: 500,
            truck: { plate: "ABC1234", type: "big" },
            driverPayrollTrip: {
              tripAllowance: 0,
              crateReturnCommission: 0,
              charterSalary: 0,
            },
          },
        ],
      })
    );

    expect(result.rules.find((r) => r.key === "p4")?.count).toBe(1);
  });

  it("detects D5 null payment fields", () => {
    const result = scanOperationsPayrollWarnings(
      baseScanInput({
        assignedInboundLines: [
          {
            paymentMode: null,
            currency: "MYR",
            billingCompany: "haidee",
            sessionDate: "10/06/2026",
            shipperCode: "P001",
            shipperName: "Test Shipper",
            marketCode: "BM",
            quantity: 5,
          },
        ],
      })
    );

    expect(result.rules.find((r) => r.key === "d5")?.count).toBe(1);
  });

  it("excludes NO_RETURN imports from commission winners", () => {
    const result = scanOperationsPayrollWarnings(
      baseScanInput({
        dispatches: [
          {
            id: "d1",
            dispatchNo: "DO-004",
            date: new Date("2026-06-10T00:00:00.000Z"),
            createdAt: new Date("2026-06-10T08:00:00.000Z"),
            driverName: "Ali",
            markets: ["BM"],
            truckId: "truck-1",
            truck: { plate: "ABC1234", type: "big" },
            lines: [],
            payrollTrip: {
              tripAllowance: 100,
              crateReturnCommission: 0,
              charterSalary: 0,
            },
          },
        ],
        imports: [
          {
            date: new Date("2026-06-10T00:00:00.000Z"),
            quantity: 10,
            truckId: "truck-1",
            notes: "NO_RETURN",
            truck: { plate: "ABC1234", type: "big" },
            market: { code: "BM" },
          },
        ],
      })
    );

    expect(result.rules.find((r) => r.key === "p3")).toBeUndefined();
  });

  it("detects P3 dispatch commission gap when import exists", () => {
    const result = scanOperationsPayrollWarnings(
      baseScanInput({
        dispatches: [
          {
            id: "d1",
            dispatchNo: "DO-005",
            date: new Date("2026-06-10T00:00:00.000Z"),
            createdAt: new Date("2026-06-10T08:00:00.000Z"),
            driverName: "Ali",
            markets: ["BM"],
            truckId: "truck-1",
            truck: { plate: "ABC1234", type: "big" },
            lines: [],
            payrollTrip: {
              tripAllowance: 100,
              crateReturnCommission: 0,
              charterSalary: 0,
            },
          },
        ],
        imports: [
          {
            date: new Date("2026-06-10T00:00:00.000Z"),
            quantity: 10,
            truckId: "truck-1",
            notes: null,
            truck: { plate: "ABC1234", type: "big" },
            market: { code: "BM" },
          },
        ],
      })
    );

    expect(result.rules.find((r) => r.key === "p3")?.count).toBe(1);
    expect(result.rules.find((r) => r.key === "p3")?.totalReturnCrates).toBe(10);
  });
});
