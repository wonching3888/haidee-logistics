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
    charterSalary: unknown;
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
  charterSalaryTotal: number;
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
  /** Company-cost payroll (net + employer). Used by ops/P&L. */
  totalCostMyr: number;
  /** Full driver payroll cost incl. charter salary + statutory on it. For driver payroll UI. */
  driverTotalCostMyr: number;
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

function sumTripField(
  trips: DriverPayrollMonthInput["trips"],
  field: "tripAllowance" | "charterSalary" | "extraAllowance" | "crateReturnCommission"
) {
  return roundMoney(
    trips.reduce(
      (sum, trip) => sum + (decimalToNumber(trip[field]) ?? 0),
      0
    )
  );
}

function statutoryOverridesFromInput(
  overrides: DriverPayrollOverridesInput | undefined
) {
  const source = overrides ?? EMPTY_OVERRIDES;
  return {
    epfEmployee: decimalToNumber(source.epfEmployeeOverride),
    epfEmployer: decimalToNumber(source.epfEmployerOverride),
    socsoEmployee: decimalToNumber(source.socsoEmployeeOverride),
    socsoEmployer: decimalToNumber(source.socsoEmployerOverride),
    eisEmployee: decimalToNumber(source.eisEmployeeOverride),
    eisEmployer: decimalToNumber(source.eisEmployerOverride),
    pcb: decimalToNumber(source.pcbOverride),
  };
}

function earningsFromTrips(
  driver: DriverPayrollDriverInput,
  trips: DriverPayrollMonthInput["trips"],
  extras: DriverPayrollMonthInput["extras"],
  options?: { excludeCharterSalary?: boolean }
) {
  const charterSalaryTotal = options?.excludeCharterSalary
    ? 0
    : sumTripField(trips, "charterSalary");

  return {
    baseSalary: driver.baseSalary ?? 0,
    tripAllowanceTotal: sumTripField(trips, "tripAllowance"),
    charterSalaryTotal,
    crateCommissionTotal: sumTripField(trips, "crateReturnCommission"),
    tripExtraAllowanceTotal: sumTripField(trips, "extraAllowance"),
    extraAllowanceTotal: roundMoney(
      extras
        .filter((item) => item.type === "extra_allowance")
        .reduce((sum, item) => sum + (decimalToNumber(item.amount) ?? 0), 0)
    ),
    advanceTotal: roundMoney(
      extras
        .filter((item) => item.type === "advance")
        .reduce((sum, item) => sum + (decimalToNumber(item.amount) ?? 0), 0)
    ),
  };
}

/** Full driver summary (charter salary in gross + statutory). */
export function buildDriverPayrollSummaryFromRecords(input: {
  driver: DriverPayrollDriverInput;
  trips: DriverPayrollMonthInput["trips"];
  extras: DriverPayrollMonthInput["extras"];
  overrides?: DriverPayrollOverridesInput;
}): PayrollSummary {
  return buildPayrollSummary({
    earnings: earningsFromTrips(input.driver, input.trips, input.extras),
    maritalStatus: input.driver.maritalStatus,
    childCount: input.driver.childCount,
    overrides: statutoryOverridesFromInput(input.overrides),
  });
}

/** Company-cost summary (includes charterSalary — Step 2+3 single source via payroll). */
export function buildCompanyPayrollSummaryFromRecords(input: {
  driver: DriverPayrollDriverInput;
  trips: DriverPayrollMonthInput["trips"];
  extras: DriverPayrollMonthInput["extras"];
  overrides?: DriverPayrollOverridesInput;
}): PayrollSummary {
  return buildPayrollSummary({
    earnings: earningsFromTrips(input.driver, input.trips, input.extras),
    maritalStatus: input.driver.maritalStatus,
    childCount: input.driver.childCount,
    overrides: statutoryOverridesFromInput(input.overrides),
  });
}

export function payrollCompanyCostMyr(summary: PayrollSummary) {
  return roundMoney(
    summary.netSalary +
      summary.statutory.epfEmployer +
      summary.statutory.socsoEmployer +
      summary.statutory.eisEmployer
  );
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
    charterSalaryTotal: summary.charterSalaryTotal,
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
  rows: DriverPayrollSummaryRow[],
  companyCostByDriverId: Map<string, number>
): FleetPayrollAggregate {
  const totals = rows.reduce(
    (acc, row) => ({
      name: "合计",
      baseSalary: acc.baseSalary + row.baseSalary,
      tripAllowanceTotal: acc.tripAllowanceTotal + row.tripAllowanceTotal,
      charterSalaryTotal: acc.charterSalaryTotal + row.charterSalaryTotal,
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
      charterSalaryTotal: 0,
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
    charterSalaryTotal: roundMoney(totals.charterSalaryTotal),
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
  const driverTotalCostMyr = roundMoney(netMyr + employerMyr);
  const totalCostMyr = roundMoney(
    rows.reduce(
      (sum, row) => sum + (companyCostByDriverId.get(row.driverId) ?? 0),
      0
    )
  );

  return {
    rows,
    totals: roundedTotals,
    netMyr,
    employerMyr,
    totalCostMyr,
    driverTotalCostMyr,
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

  const companyCostByDriverId = new Map<string, number>();
  const rows = drivers.map((driver) => {
    const driverInput: DriverPayrollDriverInput = {
      id: driver.id,
      name: driver.name,
      baseSalary: decimalToNumber(driver.baseSalary),
      maritalStatus: driver.maritalStatus as MaritalStatus | null,
      childCount: driver.childCount,
    };
    const monthRecord = driver.payrollMonths[0];
    const trips = monthRecord?.trips ?? [];
    const extras = monthRecord?.extras ?? [];
    const overrides = monthRecord;

    const summary = buildDriverPayrollSummaryFromRecords({
      driver: driverInput,
      trips,
      extras,
      overrides,
    });
    const companySummary = buildCompanyPayrollSummaryFromRecords({
      driver: driverInput,
      trips,
      extras,
      overrides,
    });
    companyCostByDriverId.set(
      driver.id,
      payrollCompanyCostMyr(companySummary)
    );

    return payrollSummaryToRow(
      driverInput,
      summary,
      Boolean(monthRecord)
    );
  });

  return aggregateFleetPayrollRows(rows, companyCostByDriverId);
}
