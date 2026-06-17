import { prisma } from "@/lib/prisma";
import type { PaymentMode } from "@/lib/constants/freight-settings";
import { WTL_SST_MULTIPLIER } from "@/lib/constants/freight-settings";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  isMissingRateGap,
  normalizeMcDeliveryMode,
  type InboundFreightGapReason,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  fetchOperationsAssignedInboundLines,
  type OperationsAssignedInboundLine,
} from "@/lib/operations-inbound-lines";
import {
  getOperationsFreightContext,
  preloadOperationsFreightContexts,
} from "@/lib/operations-freight-preload";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function addIncomeAmount(
  totals: {
    mode1aThb: number;
    mode1bMyr: number;
    mode2Myr: number;
    wtlMode3Myr: number;
    wtlShipperMyr: number;
  },
  paymentMode: PaymentMode,
  amount: number,
  currency: string,
  billingCompany?: string | null
) {
  if (amount <= 0) return;

  if (
    paymentMode === "1b" &&
    currency === "MYR" &&
    billingCompany === "wtl"
  ) {
    totals.wtlShipperMyr += amount;
    return;
  }

  if (paymentMode === "1a" && currency === "THB") {
    totals.mode1aThb += amount;
    return;
  }
  if (paymentMode === "1b" && currency === "MYR") {
    totals.mode1bMyr += amount;
    return;
  }
  if (paymentMode === "2" && currency === "MYR") {
    totals.mode2Myr += amount;
    return;
  }
  if (paymentMode === "3" && currency === "MYR") {
    totals.wtlMode3Myr += amount;
  }
}

export interface OperationsIncomeWarningSample {
  shipperCode: string;
  shipperName: string;
  marketCode: string;
  quantity: number;
  reason: InboundFreightGapReason;
}

export interface OperationsIncomeResult {
  mode1aThb: number;
  mode1bMyr: number;
  mode2Myr: number;
  wtlMode3Myr: number;
  wtlShipperMyr: number;
  lineCount: number;
  missingRateLineCount: number;
  missingRateQuantity: number;
  gapReasons: Partial<Record<InboundFreightGapReason, number>>;
  warningSamples: OperationsIncomeWarningSample[];
}

const WARNING_SAMPLE_LIMIT = 8;
const NKL_CONSIGNEE_CODE = "3000-N001";

async function aggregateNklPermitIncome(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const consignee = await prisma.consignee.findUnique({
    where: { code: NKL_CONSIGNEE_CODE },
    select: { id: true },
  });
  if (!consignee) return 0;

  const market = await prisma.market.findUnique({
    where: { code: "NT" },
    select: { id: true },
  });
  if (!market) return 0;

  const rateRow = await prisma.consigneeFreightRate.findFirst({
    where: {
      consigneeId: consignee.id,
      marketId: market.id,
      effectiveDate: { lte: end },
    },
    orderBy: { effectiveDate: "desc" },
    select: { permitPerTrip: true, sstApplicable: true },
  });
  const permitBase = rateRow?.permitPerTrip
    ? Number(rateRow.permitPerTrip)
    : 0;
  if (permitBase <= 0) return 0;

  const permitPerTrip = rateRow?.sstApplicable
    ? roundMoney(permitBase * WTL_SST_MULTIPLIER)
    : permitBase;

  const trips = await prisma.dispatchOrder.findMany({
    where: {
      date: { gte: start, lte: end },
      status: { notIn: ["draft", "cancelled"] },
      lines: {
        some: {
          inboundLine: {
            stall: { consigneeId: consignee.id },
            dispatchStatus: "assigned",
          },
        },
      },
    },
    select: { id: true },
  });

  return roundMoney(trips.length * permitPerTrip);
}

export async function aggregateOperationsIncome(
  year: number,
  month: number,
  preloadedLines?: OperationsAssignedInboundLine[]
): Promise<OperationsIncomeResult> {
  const { end } = getMonthDateRange(year, month);

  const lines =
    preloadedLines ?? (await fetchOperationsAssignedInboundLines(year, month));

  const freightCache = await preloadOperationsFreightContexts(lines, end);

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    const shipperId = line.session.shipperId;
    const group = linesByShipper.get(shipperId) ?? [];
    group.push(line);
    linesByShipper.set(shipperId, group);
  }

  const totals = {
    mode1aThb: 0,
    mode1bMyr: 0,
    mode2Myr: 0,
    wtlMode3Myr: 0,
    wtlShipperMyr: 0,
  };
  const gapReasons: Partial<Record<InboundFreightGapReason, number>> = {};
  const warningSamples: OperationsIncomeWarningSample[] = [];
  let missingRateLineCount = 0;
  let missingRateQuantity = 0;

  for (const shipperLines of Array.from(linesByShipper.values())) {
    for (const line of shipperLines) {
      const ctx = getOperationsFreightContext(
        freightCache,
        line,
        end,
        shipperLines
      );
      const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? "";
      const snapshot = computeInboundLineFreight(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(
            marketCode,
            line.mcDeliveryMode
          ),
        },
        ctx
      );

      const gapReason = classifyInboundFreightGap(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(
            marketCode,
            line.mcDeliveryMode
          ),
        },
        ctx,
        snapshot
      );

      if (gapReason) {
        gapReasons[gapReason] = (gapReasons[gapReason] ?? 0) + 1;
        if (isMissingRateGap(gapReason)) {
          missingRateLineCount += 1;
          missingRateQuantity += line.quantity;
          if (warningSamples.length < WARNING_SAMPLE_LIMIT) {
            warningSamples.push({
              shipperCode: line.session.shipper.code,
              shipperName: line.session.shipper.name,
              marketCode,
              quantity: line.quantity,
              reason: gapReason,
            });
          }
        }
      }

      if (snapshot.freightAmount == null || snapshot.freightAmount <= 0) {
        continue;
      }

      addIncomeAmount(
        totals,
        snapshot.paymentMode,
        snapshot.freightAmount,
        snapshot.currency,
        snapshot.billingCompany
      );

      if ((snapshot.dualPaymentWtlAmount ?? 0) > 0) {
        addIncomeAmount(totals, "3", snapshot.dualPaymentWtlAmount!, "MYR");
      }
    }
  }

  const permitMyr = await aggregateNklPermitIncome(year, month);
  totals.wtlMode3Myr += permitMyr;

  return {
    mode1aThb: roundMoney(totals.mode1aThb),
    mode1bMyr: roundMoney(totals.mode1bMyr),
    mode2Myr: roundMoney(totals.mode2Myr),
    wtlMode3Myr: roundMoney(totals.wtlMode3Myr),
    wtlShipperMyr: roundMoney(totals.wtlShipperMyr),
    lineCount: lines.length,
    missingRateLineCount,
    missingRateQuantity,
    gapReasons,
    warningSamples,
  };
}
