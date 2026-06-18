"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import type { UserRole } from "@/types";
import {
  formatInvoicePeriodLabel,
  getMonthlyInvoiceModeConfig,
  isMonthlyInvoiceMode,
  type MonthlyInvoiceMode,
} from "@/lib/constants/monthly-invoice";
import {
  buildMonthlyInvoiceCustomerSummaries,
  buildMonthlyInvoiceData,
  type RawInvoiceLine,
} from "@/lib/monthly-invoice";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { decimalToNumber } from "@/lib/freight-rates";

async function requireFreightViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewFreightInfo(user.role as UserRole)) {
    throw new Error("无权限查看车力账单 Unauthorized");
  }
  return user;
}

function parseYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
}

const invoiceLineInclude = {
  session: {
    select: {
      date: true,
      shipper: { select: { id: true, code: true, name: true } },
    },
  },
  stall: {
    include: { market: { select: { code: true } } },
  },
  tongType: { select: { code: true, isBox: true } },
  consignee: { select: { id: true, code: true, name: true } },
  dualPaymentWtlConsignee: { select: { id: true, code: true, name: true } },
} as const;

type InvoiceLineRow = Awaited<
  ReturnType<typeof prisma.inboundLine.findMany>
>[number] & {
  session: {
    date: Date;
    shipper: { id: string; code: string; name: string };
  };
  stall: {
    code: string;
    name: string | null;
    market: { code: string } | null;
  };
  tongType: { code: string; isBox: boolean };
  consignee: { id: string; code: string; name: string } | null;
  dualPaymentWtlConsignee: { id: string; code: string; name: string } | null;
};

function mapPrimaryInvoiceLine(line: InvoiceLineRow): RawInvoiceLine {
  return {
    sessionDate: line.session.date,
    stallMarketCode: line.stall.market?.code ?? "",
    stallCode: line.stall.code,
    stallName: line.stall.name,
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    thFreightRate: decimalToNumber(line.thFreightRate),
    thFreightAmount: decimalToNumber(line.thFreightAmount),
    mySegmentFreightRate: decimalToNumber(line.mySegmentFreightRate),
    mySegmentFreightAmount: decimalToNumber(line.mySegmentFreightAmount),
    isBox: line.isBox,
    shipperId: line.session.shipper.id,
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    consigneeId: line.consigneeId ?? line.consignee?.id ?? null,
    consigneeCode: line.consignee?.code ?? null,
    consigneeName: line.consignee?.name ?? null,
  };
}

function mapDualPaymentWtlInvoiceLine(line: InvoiceLineRow): RawInvoiceLine {
  const consignee = line.dualPaymentWtlConsignee;
  return {
    sessionDate: line.session.date,
    stallMarketCode: line.stall.market?.code ?? "",
    stallCode: line.stall.code,
    stallName: line.stall.name,
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    freightRate: decimalToNumber(line.dualPaymentWtlRate),
    freightAmount: decimalToNumber(line.dualPaymentWtlAmount),
    thFreightRate: null,
    thFreightAmount: null,
    mySegmentFreightRate: null,
    mySegmentFreightAmount: null,
    isBox: line.isBox,
    shipperId: line.session.shipper.id,
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    consigneeId: line.dualPaymentWtlConsigneeId ?? consignee?.id ?? null,
    consigneeCode: consignee?.code ?? null,
    consigneeName: consignee?.name ?? null,
  };
}

async function fetchRawInvoiceLines(
  year: number,
  month: number,
  mode: MonthlyInvoiceMode
): Promise<RawInvoiceLine[]> {
  const config = getMonthlyInvoiceModeConfig(mode);
  if (!config) throw new Error("无效账单模式 Invalid invoice mode");

  const { start, end } = getMonthDateRange(year, month);

  const sessionWhere = {
    status: "confirmed" as const,
    date: { gte: start, lte: end },
  };

  const sharedWhere = {
    freightAmount: { gt: 0 },
    session: sessionWhere,
  };

  if (mode === "3") {
    const [primaryLines, dualLines] = await Promise.all([
      prisma.inboundLine.findMany({
        where: {
          paymentMode: config.paymentMode,
          billingCompany: config.billingCompany,
          currency: config.currency,
          ...sharedWhere,
        },
        include: invoiceLineInclude,
        orderBy: [{ session: { date: "asc" } }, { createdAt: "asc" }],
      }),
      prisma.inboundLine.findMany({
        where: {
          dualPaymentWtlAmount: { gt: 0 },
          session: sessionWhere,
        },
        include: invoiceLineInclude,
        orderBy: [{ session: { date: "asc" } }, { createdAt: "asc" }],
      }),
    ]);

    return [
      ...primaryLines.map((line) => mapPrimaryInvoiceLine(line as InvoiceLineRow)),
      ...dualLines.map((line) => mapDualPaymentWtlInvoiceLine(line as InvoiceLineRow)),
    ];
  }

  const lines = await prisma.inboundLine.findMany({
    where:
      mode === "4"
        ? {
            billingCompany: "wtl",
            currency: "MYR",
            paymentMode: { not: "3" },
            ...sharedWhere,
          }
        : {
            paymentMode: config.paymentMode,
            billingCompany: config.billingCompany,
            currency: config.currency,
            ...sharedWhere,
          },
    include: invoiceLineInclude,
    orderBy: [{ session: { date: "asc" } }, { createdAt: "asc" }],
  });

  return lines.map((line) => mapPrimaryInvoiceLine(line as InvoiceLineRow));
}

export async function getMonthlyInvoiceCustomers(input: {
  year: number;
  month: number;
  mode: string;
}) {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);
  if (!isMonthlyInvoiceMode(input.mode)) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }

  const config = getMonthlyInvoiceModeConfig(input.mode)!;
  const rawLines = await fetchRawInvoiceLines(input.year, input.month, input.mode);
  const customers = buildMonthlyInvoiceCustomerSummaries(rawLines, config);

  return {
    year: input.year,
    month: input.month,
    periodLabel: formatInvoicePeriodLabel(input.year, input.month),
    mode: config,
    customers,
  };
}

export async function getMonthlyInvoicePrintData(input: {
  year: number;
  month: number;
  mode: string;
  customerId: string;
}) {
  await requireFreightViewer();
  parseYearMonth(input.year, input.month);
  if (!isMonthlyInvoiceMode(input.mode)) {
    throw new Error("无效账单模式 Invalid invoice mode");
  }
  if (!input.customerId?.trim()) {
    throw new Error("缺少顾客 ID Missing customer ID");
  }

  const config = getMonthlyInvoiceModeConfig(input.mode)!;
  const rawLines = await fetchRawInvoiceLines(input.year, input.month, input.mode);

  return buildMonthlyInvoiceData({
    mode: config,
    year: input.year,
    month: input.month,
    periodLabel: formatInvoicePeriodLabel(input.year, input.month),
    customerId: input.customerId,
    rawLines,
  });
}
