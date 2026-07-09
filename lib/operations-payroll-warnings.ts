import { loadPayrollAllowanceContext } from "@/app/actions/allowance-settings";
import { CRATE_IMPORT_NO_RETURN_NOTE } from "@/lib/crate-import-rows";
import { toDateInputValue } from "@/lib/date-utils";
import { marketsForTripAllowance } from "@/lib/mc-dispatch-delivery";
import {
  getCachedOperationsPayrollWarnings,
  getInflightOperationsPayrollWarnings,
  operationsPayrollWarningsCacheKey,
  setCachedOperationsPayrollWarnings,
  setInflightOperationsPayrollWarnings,
} from "@/lib/operations-payroll-warnings-cache";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  dispatchMatchesDriver,
  normalizePayrollDriverName,
} from "@/lib/payroll-driver-match";
import { getRouteLabel } from "@/lib/payroll-route-label";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { decimalToNumber } from "@/lib/freight-rates";
import {
  buildCrateReturnImportContext,
  calculateTripAllowance,
  crateReturnCommissionAmount,
  getCrateReturnPlateDayInfo,
  type CrateReturnCommissionRates,
} from "@/lib/trip-allowance";

export type PayrollWarningSeverity = "high" | "medium";

export type PayrollWarningRuleKey = "p1" | "p2" | "p3" | "p4" | "p5" | "d5";

export interface PayrollWarningSample {
  driverName: string;
  date: string;
  tripNo: string | null;
  tripType?: "dispatch" | "charter";
  plate?: string;
  expectedAmount?: number;
  actualAmount?: number;
  detail?: string;
}

export interface PayrollWarningRuleResult {
  key: PayrollWarningRuleKey;
  count: number;
  sumExpected?: number;
  totalReturnCrates?: number;
  severity: PayrollWarningSeverity;
  samples: PayrollWarningSample[];
}

export interface OperationsPayrollWarningResult {
  rules: PayrollWarningRuleResult[];
  unsyncedCount: number;
  unsyncedSamples: PayrollWarningSample[];
  /** Real warnings (excludes unsynced). */
  activeWarningCount: number;
  /** Show amber payroll box when active warnings or unsynced items exist. */
  showBox: boolean;
}

const SAMPLE_LIMIT = 8;
const UNSYNCED_SAMPLE_LIMIT = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SYNC_LAG_DAYS = 2;
const SYNC_LAG_CREATED_MS = 24 * 60 * 60 * 1000;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function dateTruckKey(date: Date, truckId: string) {
  return `${toDateInputValue(date)}|${truckId}`;
}

/** Trip date within last N calendar days (UTC), or entity created within 24h. */
export function isPayrollSyncLag(
  tripDate: Date,
  createdAt: Date,
  now: Date = new Date()
): boolean {
  const lagStart = new Date(now);
  lagStart.setUTCDate(lagStart.getUTCDate() - SYNC_LAG_DAYS);
  lagStart.setUTCHours(0, 0, 0, 0);

  if (toDateInputValue(tripDate) >= toDateInputValue(lagStart)) {
    return true;
  }

  return createdAt.getTime() >= now.getTime() - SYNC_LAG_CREATED_MS;
}

export function resolvePayrollDriverForWarning(
  drivers: {
    id: string;
    name: string;
    fullName: string | null;
    nickname: string | null;
  }[],
  driverName: string | null
) {
  if (!driverName?.trim()) {
    return { name: "(未填司机)", id: null as string | null };
  }
  const matched = drivers.filter((d) =>
    dispatchMatchesDriver(d, { driverName })
  );
  if (matched.length === 1) {
    return { name: matched[0]!.name, id: matched[0]!.id };
  }
  if (matched.length > 1) {
    const orderKey = normalizePayrollDriverName(driverName);
    const exact = matched.find(
      (d) => normalizePayrollDriverName(d.name) === orderKey
    );
    if (exact) return { name: exact.name, id: exact.id };
    return { name: `${driverName} (歧义)`, id: null };
  }
  return { name: `${driverName} (未匹配)`, id: null };
}

function emptyRule(
  key: PayrollWarningRuleKey,
  severity: PayrollWarningSeverity
): PayrollWarningRuleResult {
  return { key, count: 0, severity, samples: [] };
}

function pushSample(
  rule: PayrollWarningRuleResult,
  sample: PayrollWarningSample,
  limit = SAMPLE_LIMIT
) {
  if (rule.samples.length < limit) {
    rule.samples.push(sample);
  }
}

type WinnerTrip = {
  source: "dispatch" | "charter";
  sourceTripId: string;
  tripNo: string | null;
  truckId: string;
  plate: string;
  truckType: string;
  driverName: string | null;
  date: Date;
  createdAt: Date;
  fullCommission: number;
  returnCrates: number;
  isBp: boolean;
  returnMarkets: string[];
};

export function scanOperationsPayrollWarnings(input: {
  year: number;
  month: number;
  now?: Date;
  drivers: {
    id: string;
    name: string;
    fullName: string | null;
    nickname: string | null;
  }[];
  allowanceContext: Awaited<ReturnType<typeof loadPayrollAllowanceContext>>;
  dispatches: {
    id: string;
    dispatchNo: string | null;
    date: Date;
    createdAt: Date;
    driverName: string | null;
    markets: string[];
    truckId: string;
    truck: { plate: string; type: string };
    lines: {
      inboundLine: {
        mcDeliveryMode: string | null;
        stall: { market: { code: string } | null };
      };
    }[];
    payrollTrip: {
      tripAllowance: unknown;
      crateReturnCommission: unknown;
      charterSalary: unknown;
    } | null;
  }[];
  charters: {
    id: string;
    charterNo: string | null;
    date: Date;
    createdAt: Date;
    driverName: string | null;
    truckId: string;
    charterDriverSalaryMyr: unknown;
    truck: { plate: string; type: string };
    driverPayrollTrip: {
      tripAllowance: unknown;
      crateReturnCommission: unknown;
      charterSalary: unknown;
    } | null;
  }[];
  imports: {
    date: Date;
    quantity: number;
    truckId: string;
    notes: string | null;
    truck: { plate: string; type: string };
    market: { code: string } | null;
  }[];
  assignedInboundLines: {
    paymentMode: string | null;
    currency: string | null;
    billingCompany: string | null;
    sessionDate: string;
    shipperCode: string;
    shipperName: string;
    marketCode: string | null;
    quantity: number;
  }[];
}): OperationsPayrollWarningResult {
  const now = input.now ?? new Date();
  const rates: CrateReturnCommissionRates = {
    bigTruckCrateCommission: input.allowanceContext.bigTruckCrateCommission,
    smallTruckCrateCommission: input.allowanceContext.smallTruckCrateCommission,
    bpCrateCommissionBigTruck: input.allowanceContext.bpCrateCommissionBigTruck,
    bpCrateCommissionSmallTruck:
      input.allowanceContext.bpCrateCommissionSmallTruck,
  };

  const p1 = emptyRule("p1", "high");
  const p2 = emptyRule("p2", "high");
  const p3 = emptyRule("p3", "high");
  const p4 = emptyRule("p4", "high");
  const p5 = emptyRule("p5", "medium");
  const d5 = emptyRule("d5", "medium");

  const unsyncedSamples: PayrollWarningSample[] = [];
  let unsyncedCount = 0;

  const trackUnsynced = (sample: PayrollWarningSample) => {
    unsyncedCount += 1;
    if (unsyncedSamples.length < UNSYNCED_SAMPLE_LIMIT) {
      unsyncedSamples.push(sample);
    }
  };

  const eligibleImports = input.imports.filter(
    (row) =>
      row.quantity > 0 &&
      row.notes !== CRATE_IMPORT_NO_RETURN_NOTE &&
      row.market
  );

  const importContext = buildCrateReturnImportContext(
    eligibleImports.map((row) => ({
      date: row.date,
      quantity: row.quantity,
      truck: { plate: row.truck.plate },
      market: { code: row.market!.code },
    }))
  );

  const returnCratesByDateTruck = new Map<string, number>();
  const marketsByDatePlate = new Map<string, string[]>();
  for (const row of eligibleImports) {
    const dateTruck = dateTruckKey(row.date, row.truckId);
    returnCratesByDateTruck.set(
      dateTruck,
      (returnCratesByDateTruck.get(dateTruck) ?? 0) + row.quantity
    );
    const plateKey = `${toDateInputValue(row.date)}|${row.truck.plate.trim().toUpperCase()}`;
    const list = marketsByDatePlate.get(plateKey) ?? [];
    const code = row.market!.code.trim().toUpperCase();
    if (!list.includes(code)) list.push(code);
    marketsByDatePlate.set(plateKey, list);
  }

  const dispatchByDateTruck = new Map<string, typeof input.dispatches>();
  for (const dispatch of input.dispatches) {
    const key = dateTruckKey(dispatch.date, dispatch.truckId);
    const list = dispatchByDateTruck.get(key) ?? [];
    list.push(dispatch);
    dispatchByDateTruck.set(key, list);
  }

  const charterByDateTruck = new Map<string, typeof input.charters>();
  for (const charter of input.charters) {
    const key = dateTruckKey(charter.date, charter.truckId);
    const list = charterByDateTruck.get(key) ?? [];
    list.push(charter);
    charterByDateTruck.set(key, list);
  }

  const winnerByDateTruck = new Map<string, WinnerTrip>();
  for (const dateTruck of Array.from(returnCratesByDateTruck.keys())) {
    const dispatchList = dispatchByDateTruck.get(dateTruck) ?? [];
    const charterList = charterByDateTruck.get(dateTruck) ?? [];
    const sample =
      dispatchList[0]?.truck ??
      charterList[0]?.truck ??
      eligibleImports.find((i) => dateTruckKey(i.date, i.truckId) === dateTruck)
        ?.truck;
    if (!sample) continue;

    const date = dispatchList[0]?.date ?? charterList[0]?.date;
    if (!date) continue;

    const plateKey = `${toDateInputValue(date)}|${sample.plate.trim().toUpperCase()}`;
    const returnMarkets = marketsByDatePlate.get(plateKey) ?? [];
    const plateDay = getCrateReturnPlateDayInfo(importContext, date, sample.plate);
    const isBp = Boolean(plateDay?.hasBpReturn);
    const returnCrates = returnCratesByDateTruck.get(dateTruck) ?? 0;

    if (dispatchList.length > 0) {
      const d = dispatchList[0]!;
      winnerByDateTruck.set(dateTruck, {
        source: "dispatch",
        sourceTripId: d.id,
        tripNo: d.dispatchNo,
        truckId: d.truckId,
        plate: d.truck.plate,
        truckType: d.truck.type,
        driverName: d.driverName,
        date: d.date,
        createdAt: d.createdAt,
        fullCommission: crateReturnCommissionAmount({
          truckType: d.truck.type,
          plateDay,
          rates,
        }),
        returnCrates,
        isBp,
        returnMarkets,
      });
    } else if (charterList.length > 0) {
      const c = charterList[0]!;
      winnerByDateTruck.set(dateTruck, {
        source: "charter",
        sourceTripId: c.id,
        tripNo: c.charterNo,
        truckId: c.truckId,
        plate: c.truck.plate,
        truckType: c.truck.type,
        driverName: c.driverName,
        date: c.date,
        createdAt: c.createdAt,
        fullCommission: crateReturnCommissionAmount({
          truckType: c.truck.type,
          plateDay,
          rates,
        }),
        returnCrates,
        isBp,
        returnMarkets,
      });
    }
  }

  // P1 — missing payroll row
  for (const dispatch of input.dispatches) {
    const resolved = resolvePayrollDriverForWarning(
      input.drivers,
      dispatch.driverName
    );
    if (!resolved.id || dispatch.payrollTrip) continue;

    const sample: PayrollWarningSample = {
      driverName: resolved.name,
      date: toDateInputValue(dispatch.date),
      tripNo: dispatch.dispatchNo,
      tripType: "dispatch",
      plate: dispatch.truck.plate,
    };

    if (isPayrollSyncLag(dispatch.date, dispatch.createdAt, now)) {
      trackUnsynced(sample);
      continue;
    }

    p1.count += 1;
    pushSample(p1, sample);
  }

  for (const charter of input.charters) {
    const resolved = resolvePayrollDriverForWarning(
      input.drivers,
      charter.driverName
    );
    if (!resolved.id || charter.driverPayrollTrip) continue;

    const sample: PayrollWarningSample = {
      driverName: resolved.name,
      date: toDateInputValue(charter.date),
      tripNo: charter.charterNo,
      tripType: "charter",
      plate: charter.truck.plate,
    };

    if (isPayrollSyncLag(charter.date, charter.createdAt, now)) {
      trackUnsynced(sample);
      continue;
    }

    p1.count += 1;
    pushSample(p1, sample);
  }

  // P2 — trip allowance gap (row must exist)
  for (const dispatch of input.dispatches) {
    const resolved = resolvePayrollDriverForWarning(
      input.drivers,
      dispatch.driverName
    );
    if (!resolved.id) continue;

    const assignedLines = dispatch.lines.map((row) => ({
      marketCode: row.inboundLine.stall.market?.code ?? null,
      mcDeliveryMode: row.inboundLine.mcDeliveryMode,
    }));
    const allowanceMarkets = marketsForTripAllowance(
      dispatch.markets,
      assignedLines
    );
    const expected = calculateTripAllowance({
      markets: allowanceMarkets,
      routes: input.allowanceContext.routes,
      extraMarketAllowance: input.allowanceContext.extraMarketAllowance,
    }).tripAllowance;

    if (expected <= 0) continue;

    const payrollTrip = dispatch.payrollTrip;
    if (!payrollTrip) continue;

    const actual = decimalToNumber(payrollTrip.tripAllowance) ?? 0;
    if (roundMoney(actual) >= roundMoney(expected)) continue;

    const sample: PayrollWarningSample = {
      driverName: resolved.name,
      date: toDateInputValue(dispatch.date),
      tripNo: dispatch.dispatchNo,
      tripType: "dispatch",
      plate: dispatch.truck.plate,
      expectedAmount: roundMoney(expected),
      actualAmount: roundMoney(actual),
      detail: getRouteLabel(allowanceMarkets),
    };

    if (isPayrollSyncLag(dispatch.date, dispatch.createdAt, now)) {
      trackUnsynced(sample);
      continue;
    }

    p2.count += 1;
    p2.sumExpected = roundMoney((p2.sumExpected ?? 0) + expected);
    pushSample(p2, sample);
  }

  // P3 — dispatch winner commission
  for (const winner of Array.from(winnerByDateTruck.values())) {
    if (winner.source !== "dispatch" || winner.fullCommission <= 0) continue;

    const dispatch = input.dispatches.find((d) => d.id === winner.sourceTripId);
    if (!dispatch) continue;

    const resolved = resolvePayrollDriverForWarning(
      input.drivers,
      winner.driverName
    );
    const actual = dispatch.payrollTrip
      ? decimalToNumber(dispatch.payrollTrip.crateReturnCommission) ?? 0
      : 0;

    if (roundMoney(actual) >= roundMoney(winner.fullCommission)) continue;

    const sample: PayrollWarningSample = {
      driverName: resolved.name,
      date: toDateInputValue(winner.date),
      tripNo: winner.tripNo,
      tripType: "dispatch",
      plate: winner.plate,
      expectedAmount: roundMoney(winner.fullCommission),
      actualAmount: roundMoney(actual),
      detail: `${winner.returnCrates}桶 · ${winner.returnMarkets.join("/")}`,
    };

    if (isPayrollSyncLag(winner.date, winner.createdAt, now)) {
      trackUnsynced(sample);
      continue;
    }

    p3.count += 1;
    p3.totalReturnCrates = (p3.totalReturnCrates ?? 0) + winner.returnCrates;
    pushSample(p3, sample);
  }

  // P4 — charter salary
  for (const charter of input.charters) {
    const resolved = resolvePayrollDriverForWarning(
      input.drivers,
      charter.driverName
    );
    if (!resolved.id) continue;

    const expectedSalary = decimalToNumber(charter.charterDriverSalaryMyr) ?? 0;
    if (expectedSalary <= 0) continue;

    const payrollTrip = charter.driverPayrollTrip;
    const actualSalary = payrollTrip
      ? decimalToNumber(payrollTrip.charterSalary) ?? 0
      : 0;

    if (roundMoney(actualSalary) >= roundMoney(expectedSalary)) continue;

    const sample: PayrollWarningSample = {
      driverName: resolved.name,
      date: toDateInputValue(charter.date),
      tripNo: charter.charterNo,
      tripType: "charter",
      plate: charter.truck.plate,
      expectedAmount: roundMoney(expectedSalary),
      actualAmount: roundMoney(actualSalary),
    };

    if (isPayrollSyncLag(charter.date, charter.createdAt, now)) {
      trackUnsynced(sample);
      continue;
    }

    p4.count += 1;
    p4.sumExpected = roundMoney((p4.sumExpected ?? 0) + expectedSalary);
    pushSample(p4, sample);
  }

  // P5 — charter winner commission
  for (const winner of Array.from(winnerByDateTruck.values())) {
    if (winner.source !== "charter" || winner.fullCommission <= 0) continue;

    const charter = input.charters.find((c) => c.id === winner.sourceTripId);
    if (!charter) continue;

    const resolved = resolvePayrollDriverForWarning(
      input.drivers,
      winner.driverName
    );
    const actual = charter.driverPayrollTrip
      ? decimalToNumber(charter.driverPayrollTrip.crateReturnCommission) ?? 0
      : 0;

    if (roundMoney(actual) >= roundMoney(winner.fullCommission)) continue;

    const sample: PayrollWarningSample = {
      driverName: resolved.name,
      date: toDateInputValue(winner.date),
      tripNo: winner.tripNo,
      tripType: "charter",
      plate: winner.plate,
      expectedAmount: roundMoney(winner.fullCommission),
      actualAmount: roundMoney(actual),
      detail: `${winner.returnCrates}桶 · ${winner.returnMarkets.join("/")}`,
    };

    if (isPayrollSyncLag(winner.date, winner.createdAt, now)) {
      trackUnsynced(sample);
      continue;
    }

    p5.count += 1;
    p5.totalReturnCrates = (p5.totalReturnCrates ?? 0) + winner.returnCrates;
    pushSample(p5, sample);
  }

  // D5 — null payment fields on assigned inbound lines
  for (const line of input.assignedInboundLines) {
    const missingFields: string[] = [];
    if (line.paymentMode == null) missingFields.push("paymentMode");
    if (line.currency == null) missingFields.push("currency");
    if (line.billingCompany == null) missingFields.push("billingCompany");
    if (missingFields.length === 0) continue;

    d5.count += 1;
    pushSample(d5, {
      driverName: line.shipperName,
      date: line.sessionDate,
      tripNo: line.shipperCode,
      detail: `${line.marketCode ?? "—"} · ${missingFields.join("/")} · ${line.quantity}桶`,
    });
  }

  const rules = [p1, p2, p3, p4, p5, d5].filter((rule) => rule.count > 0);
  const activeWarningCount = rules.reduce((sum, rule) => sum + rule.count, 0);

  return {
    rules,
    unsyncedCount,
    unsyncedSamples,
    activeWarningCount,
    showBox: activeWarningCount > 0 || unsyncedCount > 0,
  };
}

async function loadPayrollWarningMonthData(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);

  const [
    allowanceContext,
    drivers,
    imports,
    dispatches,
    charters,
    assignedInboundLineRows,
  ] = await Promise.all([
    loadPayrollAllowanceContext(),
    prisma.driver.findMany({
      select: { id: true, name: true, fullName: true, nickname: true },
    }),
    prisma.tongImport.findMany({
      where: {
        date: { gte: start, lte: end },
        quantity: { gt: 0 },
        NOT: { notes: CRATE_IMPORT_NO_RETURN_NOTE },
      },
      select: {
        date: true,
        quantity: true,
        truckId: true,
        notes: true,
        truck: { select: { plate: true, type: true } },
        market: { select: { code: true } },
      },
    }),
    prisma.dispatchOrder.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { notIn: ["cancelled", "draft"] },
      },
      select: {
        id: true,
        dispatchNo: true,
        date: true,
        createdAt: true,
        driverName: true,
        markets: true,
        truckId: true,
        truck: { select: { plate: true, type: true } },
        lines: {
          select: {
            inboundLine: {
              select: {
                mcDeliveryMode: true,
                stall: { select: { market: { select: { code: true } } } },
              },
            },
          },
        },
        payrollTrip: {
          select: {
            tripAllowance: true,
            crateReturnCommission: true,
            charterSalary: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.charterTrip.findMany({
      where: { date: { gte: start, lte: end } },
      select: {
        id: true,
        charterNo: true,
        date: true,
        createdAt: true,
        driverName: true,
        truckId: true,
        charterDriverSalaryMyr: true,
        truck: { select: { plate: true, type: true } },
        driverPayrollTrip: {
          select: {
            tripAllowance: true,
            crateReturnCommission: true,
            charterSalary: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.inboundLine.findMany({
      where: {
        dispatchStatus: "assigned",
        dispatchLines: {
          some: {
            dispatchOrder: {
              date: { gte: start, lte: end },
              status: { notIn: ["draft", "cancelled"] },
            },
          },
        },
      },
      select: {
        paymentMode: true,
        currency: true,
        billingCompany: true,
        quantity: true,
        session: {
          select: {
            date: true,
            shipper: { select: { code: true, name: true } },
          },
        },
        stall: { select: { market: { select: { code: true } } } },
      },
    }),
  ]);

  return {
    allowanceContext,
    drivers,
    imports,
    dispatches,
    charters,
    assignedInboundLines: assignedInboundLineRows.map((line) => ({
      paymentMode: line.paymentMode,
      currency: line.currency,
      billingCompany: line.billingCompany,
      sessionDate: formatDisplayDate(line.session.date),
      shipperCode: line.session.shipper.code,
      shipperName: line.session.shipper.name,
      marketCode: line.stall.market?.code ?? null,
      quantity: line.quantity,
    })),
  };
}

export async function aggregateOperationsPayrollWarnings(
  year: number,
  month: number
): Promise<OperationsPayrollWarningResult> {
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const cacheKey = operationsPayrollWarningsCacheKey(yearMonth);

  const cached = getCachedOperationsPayrollWarnings(cacheKey);
  if (cached) return cached;

  const inflight = getInflightOperationsPayrollWarnings(cacheKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const data = await loadPayrollWarningMonthData(year, month);
    const result = scanOperationsPayrollWarnings({
      year,
      month,
      drivers: data.drivers,
      allowanceContext: data.allowanceContext,
      dispatches: data.dispatches,
      charters: data.charters,
      imports: data.imports,
      assignedInboundLines: data.assignedInboundLines,
    });
    setCachedOperationsPayrollWarnings(cacheKey, result);
    return result;
  })();

  setInflightOperationsPayrollWarnings(cacheKey, promise);
  return promise;
}

export { MS_PER_DAY, SYNC_LAG_CREATED_MS, SYNC_LAG_DAYS };
