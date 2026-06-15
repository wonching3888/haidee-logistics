import { decimalToNumber } from "@/lib/freight-rates";
import { buildPayrollSummary } from "@/lib/payroll-statutory";
import type { MaritalStatus } from "@/lib/constants/payroll";
import type { PayrollSummary } from "@/lib/payroll-statutory";
import { prisma } from "@/lib/prisma";
import { syncFleetPayrollForMonth } from "@/lib/payroll-month-sync";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface DriverPayrollDriverInput {
  id: string;
  name: string;
  baseSalary: number | null;
  maritalStatus: MaritalStatus | null;
  childCount: number;
}

export interface DriverPayrollOverridesInput {
  epfEmployeeOverride?: unknown;
  epfEmployerOverride?: unknown;
  socsoEmployeeOverride?: unknown;
  socsoEmployerOverride?: unknown;
  eisEmployeeOverride?: unknown;
  eisEmployerOverride?: unknown;
  pcbOverride?: unknown;
}

export interface DriverPayrollMonthInput {
  trips: {
    tripAllowance: unknown;
    extraAllowance: unknown;
    crateReturnCommission: unknown;
  }[];
  extras: { type: string; amount: unknown }[];
  epfEmployeeOverride?: unknown;
  epfEmployerOverride?: unknown;
  socsoEmployeeOverride?: unknown;
  socsoEmployerOverride?: unknown;
  eisEmployeeOverride?: unknown;
  eisEmployerOverride?: unknown;
  pcbOverride?: unknown;
}

export interface DriverPayrollSummaryRow {
  driverId: string;
  name: string;
  baseSalary: number;
  tripAllowanceTotal: number;
  crateCommissionTotal: number;
  extraAllowanceTotal: number;
  grossSalary: number;
  epfEmployee: number;
  socsoEmployee: number;
  eisEmployee: number;
  pcb: number;
  netSalary: number;
  epfEmployer: number;
  socsoEmployer: number;
  eisEmployer: number;
  employerContributionTotal: number;
  hasMonthRecord: boolean;
}

export interface FleetPayrollAggregate {
  rows: DriverPayrollSummaryRow[];
  totals: Omit<DriverPayrollSummaryRow, "driverId" | "hasMonthRecord">;
  netMyr: number;
  employerMyr: number;
  totalCostMyr: number;
  hasRecords: boolean;
}

const EMPTY_OVERRIDES = {
  epfEmployeeOverride: null,
  epfEmployerOverride: null,
  socsoEmployeeOverride: null,
  socsoEmployerOverride: null,
  eisEmployeeOverride: null,
  eisEmployerOverride: null,
  pcbOverride: null,
};

export function buildDriverPayrollSummaryFromRecords(input: {
  driver: DriverPayrollDriverInput;
  trips: DriverPayrollMonthInput["trips"];
  extras: DriverPayrollMonthInput["extras"];
  overrides?: DriverPayrollOverridesInput;
}): PayrollSummary {
  const tripAllowanceTotal = roundMoney(
    input.trips.reduce(
      (sum, trip) => sum + (decimalToNumber(trip.tripAllowance) ?? 0),
      0
    )
  );
  const tripExtraAllowanceTotal = roundMoney(
    input.trips.reduce(
      (sum, trip) => sum + (decimalToNumber(trip.extraAllowance) ?? 0),
      0
    )
  );
  const crateCommissionTotal = roundMoney(
    input.trips.reduce(
      (sum, trip) => sum + (decimalToNumber(trip.crateReturnCommission) ?? 0),
      0
    )
  );
  const extraAllowanceTotal = roundMoney(
    input.extras
      .filter((item) => item.type === "extra_allowance")
      .reduce((sum, item) => sum + (decimalToNumber(item.amount) ?? 0), 0)
  );
  const advanceTotal = roundMoney(
    input.extras
      .filter((item) => item.type === "advance")
      .reduce((sum, item) => sum + (decimalToNumber(item.amount) ?? 0), 0)
  );

  const overrides = input.overrides ?? EMPTY_OVERRIDES;

  return buildPayrollSummary({
    earnings: {
      baseSalary: input.driver.baseSalary ?? 0,
      tripAllowanceTotal,
      crateCommissionTotal,
      tripExtraAllowanceTotal,
      extraAllowanceTotal,
      advanceTotal,
    },
    maritalStatus: input.driver.maritalStatus,
    childCount: input.driver.childCount,
    overrides: {
      epfEmployee: decimalToNumber(overrides.epfEmployeeOverride),
      epfEmployer: decimalToNumber(overrides.epfEmployerOverride),
      socsoEmployee: decimalToNumber(overrides.socsoEmployeeOverride),
      socsoEmployer: decimalToNumber(overrides.socsoEmployerOverride),
      eisEmployee: decimalToNumber(overrides.eisEmployeeOverride),
      eisEmployer: decimalToNumber(overrides.eisEmployerOverride),
      pcb: decimalToNumber(overrides.pcbOverride),
    },
  });
}

export function payrollSummaryToRow(
  driver: DriverPayrollDriverInput,
  summary: PayrollSummary,
  hasMonthRecord: boolean
): DriverPayrollSummaryRow {
  const employerContributionTotal = roundMoney(
    summary.statutory.epfEmployer +
      summary.statutory.socsoEmployer +
      summary.statutory.eisEmployer
  );

  return {
    driverId: driver.id,
    name: driver.name,
    baseSalary: summary.baseSalary,
    tripAllowanceTotal: summary.tripAllowanceTotal,
    crateCommissionTotal: summary.crateCommissionTotal,
    extraAllowanceTotal: summary.extraAllowanceTotal,
    grossSalary: summary.grossSalary,
    epfEmployee: summary.statutory.epfEmployee,
    socsoEmployee: summary.statutory.socsoEmployee,
    eisEmployee: summary.statutory.eisEmployee,
    pcb: summary.statutory.pcb,
    netSalary: summary.netSalary,
    epfEmployer: summary.statutory.epfEmployer,
    socsoEmployer: summary.statutory.socsoEmployer,
    eisEmployer: summary.statutory.eisEmployer,
    employerContributionTotal,
    hasMonthRecord,
  };
}

export function aggregateFleetPayrollRows(
  rows: DriverPayrollSummaryRow[]
): FleetPayrollAggregate {
  const totals = rows.reduce(
    (acc, row) => ({
      name: "合计",
      baseSalary: acc.baseSalary + row.baseSalary,
      tripAllowanceTotal: acc.tripAllowanceTotal + row.tripAllowanceTotal,
      crateCommissionTotal: acc.crateCommissionTotal + row.crateCommissionTotal,
      extraAllowanceTotal: acc.extraAllowanceTotal + row.extraAllowanceTotal,
      grossSalary: acc.grossSalary + row.grossSalary,
      epfEmployee: acc.epfEmployee + row.epfEmployee,
      socsoEmployee: acc.socsoEmployee + row.socsoEmployee,
      eisEmployee: acc.eisEmployee + row.eisEmployee,
      pcb: acc.pcb + row.pcb,
      netSalary: acc.netSalary + row.netSalary,
      epfEmployer: acc.epfEmployer + row.epfEmployer,
      socsoEmployer: acc.socsoEmployer + row.socsoEmployer,
      eisEmployer: acc.eisEmployer + row.eisEmployer,
      employerContributionTotal:
        acc.employerContributionTotal + row.employerContributionTotal,
    }),
    {
      name: "合计",
      baseSalary: 0,
      tripAllowanceTotal: 0,
      crateCommissionTotal: 0,
      extraAllowanceTotal: 0,
      grossSalary: 0,
      epfEmployee: 0,
      socsoEmployee: 0,
      eisEmployee: 0,
      pcb: 0,
      netSalary: 0,
      epfEmployer: 0,
      socsoEmployer: 0,
      eisEmployer: 0,
      employerContributionTotal: 0,
    }
  );

  const roundedTotals = {
    name: totals.name,
    baseSalary: roundMoney(totals.baseSalary),
    tripAllowanceTotal: roundMoney(totals.tripAllowanceTotal),
    crateCommissionTotal: roundMoney(totals.crateCommissionTotal),
    extraAllowanceTotal: roundMoney(totals.extraAllowanceTotal),
    grossSalary: roundMoney(totals.grossSalary),
    epfEmployee: roundMoney(totals.epfEmployee),
    socsoEmployee: roundMoney(totals.socsoEmployee),
    eisEmployee: roundMoney(totals.eisEmployee),
    pcb: roundMoney(totals.pcb),
    netSalary: roundMoney(totals.netSalary),
    epfEmployer: roundMoney(totals.epfEmployer),
    socsoEmployer: roundMoney(totals.socsoEmployer),
    eisEmployer: roundMoney(totals.eisEmployer),
    employerContributionTotal: roundMoney(totals.employerContributionTotal),
  };

  const netMyr = roundedTotals.netSalary;
  const employerMyr = roundedTotals.employerContributionTotal;

  return {
    rows,
    totals: roundedTotals,
    netMyr,
    employerMyr,
    totalCostMyr: roundMoney(netMyr + employerMyr),
    hasRecords: rows.length > 0 && rows.every((row) => row.hasMonthRecord),
  };
}

function parseYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function loadFleetPayrollAggregate(
  year: number,
  month: number,
  options?: { sync?: boolean }
) {
  if (options?.sync !== false) {
    await syncFleetPayrollForMonth(year, month);
  }

  const yearMonth = parseYearMonth(year, month);
  const drivers = await prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      payrollMonths: {
        where: { yearMonth },
        include: { trips: true, extras: true },
      },
    },
  });

  const rows = drivers.map((driver) => {
    const driverInput: DriverPayrollDriverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
    };
    const monthRecord = driver.payrollMonths[0];
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips: monthRecord?.trips ?? [],
      extras: monthRecord?.extras ?? [],
      overrides: monthRecord,
    });

    return payrollSummaryToRow(
      driverInput,
      summary,
      Boolean(monthRecord)
    );
  });

  return aggregateFleetPayrollRows(rows);
}
