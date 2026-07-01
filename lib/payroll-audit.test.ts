import { describe, expect, it } from "vitest";
import {
  diffPayrollOverrideChanges,
  diffPayrollTripFieldChanges,
  payrollAuditFieldLabel,
} from "@/lib/payroll-audit";
import { resolveHistoryEntityTypes } from "@/lib/audit-feed";
import type { DriverPayrollMonth, DriverPayrollTrip } from "@prisma/client";

function tripFixture(
  values: Pick<DriverPayrollTrip, "tripAllowance" | "extraAllowance" | "notes">
) {
  return values;
}

function monthFixture(
  values: Pick<DriverPayrollMonth, "epfEmployeeOverride" | "epfEmployerOverride" | "socsoEmployeeOverride" | "socsoEmployerOverride" | "eisEmployeeOverride" | "eisEmployerOverride" | "pcbOverride">
) {
  return values;
}

describe("diffPayrollTripFieldChanges", () => {
  it("detects tripAllowance change", () => {
    const changes = diffPayrollTripFieldChanges(
      tripFixture({
        tripAllowance: 100 as never,
        extraAllowance: 0 as never,
        notes: null,
      }),
      { tripAllowance: 120, extraAllowance: 0, notes: null }
    );
    expect(changes).toEqual([
      {
        field: "tripAllowance",
        fromValue: "100.00",
        toValue: "120.00",
      },
    ]);
  });

  it("detects notes change", () => {
    const changes = diffPayrollTripFieldChanges(
      tripFixture({
        tripAllowance: 0 as never,
        extraAllowance: 0 as never,
        notes: "old",
      }),
      { tripAllowance: 0, extraAllowance: 0, notes: "new" }
    );
    expect(changes).toEqual([
      {
        field: "notes",
        fromValue: "old",
        toValue: "new",
      },
    ]);
  });

  it("ignores unchanged fields", () => {
    const changes = diffPayrollTripFieldChanges(
      tripFixture({
        tripAllowance: 50 as never,
        extraAllowance: 10 as never,
        notes: "same",
      }),
      { tripAllowance: 50, extraAllowance: 10, notes: "same" }
    );
    expect(changes).toEqual([]);
  });
});

describe("diffPayrollOverrideChanges", () => {
  it("detects pcb override change", () => {
    const changes = diffPayrollOverrideChanges(
      monthFixture({
        epfEmployeeOverride: null,
        epfEmployerOverride: null,
        socsoEmployeeOverride: null,
        socsoEmployerOverride: null,
        eisEmployeeOverride: null,
        eisEmployerOverride: null,
        pcbOverride: 10 as never,
      }),
      { pcb: 15 }
    );
    expect(changes).toEqual([
      {
        field: "pcbOverride",
        fromValue: "10.00",
        toValue: "15.00",
      },
    ]);
  });
});

describe("payrollAuditFieldLabel", () => {
  it("maps trip fields", () => {
    expect(payrollAuditFieldLabel("tripAllowance")).toContain("Trip allowance");
  });
});

describe("resolveHistoryEntityTypes", () => {
  it("returns all types for default tab", () => {
    expect(resolveHistoryEntityTypes(undefined)).toEqual([
      "inbound",
      "voucher",
      "payroll",
      "dispatch",
      "charter",
      "invoice_payment",
      "crate",
    ]);
  });

  it("filters payroll tab", () => {
    expect(resolveHistoryEntityTypes("payroll")).toEqual(["payroll"]);
  });
});
