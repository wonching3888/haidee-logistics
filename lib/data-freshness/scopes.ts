import type { Prisma } from "@prisma/client";
import {
  getMonthlyInvoiceModeConfig,
  type MonthlyInvoiceMode,
  isMonthlyInvoiceMode,
} from "@/lib/constants/monthly-invoice";
import { OPERATIONAL_SHIPPER_WHERE } from "@/lib/constants/shipper-kind";
import { parseDateInput } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import type {
  CustomerCrateStockFingerprint,
  DailyOpsFingerprint,
  DataFreshnessFingerprint,
  DataFreshnessScope,
  InboundFingerprint,
  MonthlyInvoiceFingerprint,
} from "@/lib/data-freshness/types";

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function opt(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildInboundSessionWhere(params: {
  date?: string;
  shipperId?: string;
  status?: string;
  search?: string;
}): Prisma.InboundSessionWhereInput {
  const where: Prisma.InboundSessionWhereInput = {};

  if (params.date) {
    where.date = parseDateInput(params.date);
  }

  if (params.shipperId) {
    where.shipperId = params.shipperId;
  }

  if (params.status === "draft") {
    where.status = "draft";
  }

  if (params.status === "unassigned") {
    where.status = "confirmed";
    where.lines = { some: { dispatchStatus: "unassigned", quantity: { gt: 0 } } };
  }

  if (params.status === "assigned") {
    where.status = "confirmed";
    where.lines = { some: { quantity: { gt: 0 } } };
    where.NOT = {
      lines: { some: { dispatchStatus: "unassigned", quantity: { gt: 0 } } },
    };
  }

  if (params.search) {
    where.shipper = {
      name: { contains: params.search, mode: "insensitive" },
    };
  }

  return where;
}

export async function inboundFingerprint(params: {
  date?: string;
  shipperId?: string;
  status?: string;
  search?: string;
}): Promise<InboundFingerprint> {
  const sessionWhere = buildInboundSessionWhere({
    date: opt(params.date),
    shipperId: opt(params.shipperId),
    status: opt(params.status),
    search: opt(params.search),
  });

  const [sessionAgg, lineAgg, changeLogAgg] = await Promise.all([
    prisma.inboundSession.aggregate({
      where: sessionWhere,
      _count: true,
      _max: { createdAt: true },
    }),
    prisma.inboundLine.aggregate({
      where: { session: sessionWhere },
      _count: true,
      _max: { createdAt: true, modifiedAt: true },
    }),
    prisma.inboundChangeLog.aggregate({
      where: { session: sessionWhere },
      _count: true,
      _max: { createdAt: true },
    }),
  ]);

  return {
    sessionCount: sessionAgg._count,
    maxSessionCreatedAt: iso(sessionAgg._max.createdAt),
    lineCount: lineAgg._count,
    maxLineCreatedAt: iso(lineAgg._max.createdAt),
    maxLineModifiedAt: iso(lineAgg._max.modifiedAt),
    changeLogCount: changeLogAgg._count,
    maxChangeLogAt: iso(changeLogAgg._max.createdAt),
  };
}

export async function dailyOpsFingerprint(dateStr: string): Promise<DailyOpsFingerprint> {
  const date = parseDateInput(dateStr);
  const dispatchOrderWhere: Prisma.DispatchOrderWhereInput = {
    date,
    status: { notIn: ["draft", "cancelled"] },
  };

  const [unassigned, orders, dispatchLines] = await Promise.all([
    prisma.inboundLine.aggregate({
      where: {
        dispatchStatus: "unassigned",
        dispatchLines: { none: {} },
        session: { status: "confirmed", date },
      },
      _count: true,
      _max: { createdAt: true, modifiedAt: true },
    }),
    prisma.dispatchOrder.aggregate({
      where: dispatchOrderWhere,
      _count: true,
      _max: { createdAt: true, modifiedAt: true },
    }),
    prisma.dispatchLine.aggregate({
      where: { dispatchOrder: dispatchOrderWhere },
      _count: true,
      _max: { createdAt: true },
    }),
  ]);

  return {
    unassignedLineCount: unassigned._count,
    maxUnassignedLineCreatedAt: iso(unassigned._max.createdAt),
    maxUnassignedLineModifiedAt: iso(unassigned._max.modifiedAt),
    dispatchOrderCount: orders._count,
    maxDispatchOrderCreatedAt: iso(orders._max.createdAt),
    maxDispatchOrderModifiedAt: iso(orders._max.modifiedAt),
    dispatchLineCount: dispatchLines._count,
    maxDispatchLineCreatedAt: iso(dispatchLines._max.createdAt),
  };
}

function buildCustomerCrateShipperWhere(
  search?: string
): Prisma.ShipperWhereInput {
  return {
    ...OPERATIONAL_SHIPPER_WHERE,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function customerCrateStockFingerprint(params: {
  q?: string;
}): Promise<CustomerCrateStockFingerprint> {
  const shipperWhere = buildCustomerCrateShipperWhere(opt(params.q));

  const [stockAgg, ledgerAgg] = await Promise.all([
    prisma.customerCrateStock.aggregate({
      where: { shipper: shipperWhere },
      _count: true,
      _sum: { quantity: true },
      _max: { updatedAt: true },
    }),
    prisma.customerCrateLedger.aggregate({
      where: { shipper: shipperWhere },
      _count: true,
      _max: { createdAt: true },
    }),
  ]);

  return {
    stockRowCount: stockAgg._count,
    stockQuantitySum: stockAgg._sum.quantity ?? 0,
    maxStockUpdatedAt: iso(stockAgg._max.updatedAt),
    ledgerCount: ledgerAgg._count,
    maxLedgerCreatedAt: iso(ledgerAgg._max.createdAt),
  };
}

function buildMonthlyInvoicePrimaryWhere(
  year: number,
  month: number,
  mode: MonthlyInvoiceMode
): Prisma.InboundLineWhereInput {
  const config = getMonthlyInvoiceModeConfig(mode);
  if (!config) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }

  const { start, end } = getMonthDateRange(year, month);
  const sessionWhere = {
    status: "confirmed" as const,
    date: { gte: start, lte: end },
  };
  const sharedWhere = {
    freightAmount: { gt: 0 },
    session: sessionWhere,
  };

  if (mode === "4") {
    return {
      billingCompany: "wtl",
      currency: "MYR",
      paymentMode: { not: "3" },
      ...sharedWhere,
    };
  }

  return {
    paymentMode: config.paymentMode,
    billingCompany: config.billingCompany,
    currency: config.currency,
    ...sharedWhere,
  };
}

export async function monthlyInvoiceFingerprint(params: {
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
}): Promise<MonthlyInvoiceFingerprint> {
  const { year, month, mode } = params;
  const primaryWhere = buildMonthlyInvoicePrimaryWhere(year, month, mode);
  const { start, end } = getMonthDateRange(year, month);

  const [primaryAgg, dualAgg, extraAgg] = await Promise.all([
    prisma.inboundLine.aggregate({
      where: primaryWhere,
      _count: true,
      _max: { createdAt: true, modifiedAt: true },
    }),
    mode === "3"
      ? prisma.inboundLine.aggregate({
          where: {
            dualPaymentWtlAmount: { gt: 0 },
            session: {
              status: "confirmed",
              date: { gte: start, lte: end },
            },
          },
          _count: true,
          _max: { createdAt: true, modifiedAt: true },
        })
      : Promise.resolve({
          _count: 0,
          _max: { createdAt: null, modifiedAt: null },
        }),
    prisma.monthlyInvoiceExtraCharge.aggregate({
      where: { year, month, mode },
      _count: true,
      _max: { updatedAt: true },
    }),
  ]);

  return {
    lineCount: primaryAgg._count,
    maxLineCreatedAt: iso(primaryAgg._max.createdAt),
    maxLineModifiedAt: iso(primaryAgg._max.modifiedAt),
    dualLineCount: dualAgg._count,
    maxDualLineCreatedAt: iso(dualAgg._max.createdAt),
    maxDualLineModifiedAt: iso(dualAgg._max.modifiedAt),
    extraChargeCount: extraAgg._count,
    maxExtraChargeUpdatedAt: iso(extraAgg._max.updatedAt),
  };
}

export async function resolveDataFreshnessFingerprint(
  scope: DataFreshnessScope,
  searchParams: URLSearchParams
): Promise<DataFreshnessFingerprint> {
  switch (scope) {
    case "inbound":
      return inboundFingerprint({
        date: searchParams.get("date") ?? undefined,
        shipperId: searchParams.get("shipperId") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        search: searchParams.get("search") ?? undefined,
      });
    case "daily-ops": {
      const date = searchParams.get("date");
      if (!date?.trim()) {
        throw new Error("缺少日期 Missing date");
      }
      return dailyOpsFingerprint(date.trim());
    }
    case "customer-crate-stock":
      return customerCrateStockFingerprint({
        q: searchParams.get("q") ?? undefined,
      });
    case "monthly-invoice": {
      const year = Number(searchParams.get("year"));
      const month = Number(searchParams.get("month"));
      const modeRaw = searchParams.get("mode");
      if (!Number.isFinite(year) || !Number.isFinite(month) || !modeRaw) {
        throw new Error("缺少年月或模式 Missing year, month, or mode");
      }
      if (!isMonthlyInvoiceMode(modeRaw)) {
        throw new Error("无效账单模式 Invalid invoice mode");
      }
      return monthlyInvoiceFingerprint({ year, month, mode: modeRaw });
    }
    default:
      throw new Error("未知范围 Unknown scope");
  }
}
